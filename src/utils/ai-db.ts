/**
 * AI 功能数据库
 * 用于管理提示词、对话历史和配置
 * 基于 BaseDatabase 重构
 */

import { BaseDatabase, type DBConfig } from './base-db'
import type {
  Prompt,
  PromptRecord,
  AIConversation,
  ConversationRecord,
  AIMessage,
  MessageRecord,
  LLMConfig
} from '@/types/ai'

const PROMPT_STORE = 'prompts'
const AI_CONVERSATION_STORE = 'ai_conversations'
const AI_MESSAGE_STORE = 'ai_messages'
const AI_CONFIG_STORE = 'ai_config'

/**
 * AI 数据库类
 */
class AIDatabase extends BaseDatabase {
  protected config: DBConfig = {
    name: 'ChatlogAIDB',
    version: 1,
    stores: [
      {
        name: PROMPT_STORE,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'category', keyPath: 'category', unique: false },
          { name: 'createdAt', keyPath: 'createdAt', unique: false },
          { name: 'updatedAt', keyPath: 'updatedAt', unique: false },
          { name: 'isFavorite', keyPath: 'isFavorite', unique: false },
          { name: 'isBuiltIn', keyPath: 'isBuiltIn', unique: false }
        ]
      },
      {
        name: AI_CONVERSATION_STORE,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'createdAt', keyPath: 'createdAt', unique: false },
          { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
        ]
      },
      {
        name: AI_MESSAGE_STORE,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'conversationId', keyPath: 'conversationId', unique: false },
          { name: 'role', keyPath: 'role', unique: false },
          { name: 'timestamp', keyPath: 'timestamp', unique: false }
        ]
      },
      {
        name: AI_CONFIG_STORE,
        keyPath: 'key'
      }
    ]
  }

  // ==================== 提示词相关方法 ====================

  /**
   * 保存提示词
   */
  async savePrompt(prompt: Prompt): Promise<number> {
    const data = {
      ...prompt,
      updatedAt: new Date()
    }
    return await this.save(PROMPT_STORE, data) as number
  }

  /**
   * 获取提示词
   */
  async getPrompt(id: number): Promise<PromptRecord | null> {
    return await this.get<PromptRecord>(PROMPT_STORE, id)
  }

  /**
   * 获取所有提示词
   */
  async getAllPrompts(): Promise<PromptRecord[]> {
    return await this.getAll<PromptRecord>(PROMPT_STORE)
  }

  /**
   * 按分类获取提示词
   */
  async getPromptsByCategory(category: string): Promise<PromptRecord[]> {
    return await this.getByIndex<PromptRecord>(PROMPT_STORE, 'category', category)
  }

  /**
   * 删除提示词
   */
  async deletePrompt(id: number): Promise<void> {
    await this.delete(PROMPT_STORE, id)
  }

  /**
   * 搜索提示词
   */
  async searchPrompts(keyword: string): Promise<PromptRecord[]> {
    const allPrompts = await this.getAllPrompts()
    const lowerKeyword = keyword.toLowerCase()

    return allPrompts.filter(prompt => {
      const title = (prompt.title || '').toLowerCase()
      const content = (prompt.content || '').toLowerCase()
      const description = (prompt.description || '').toLowerCase()

      return title.includes(lowerKeyword) ||
             content.includes(lowerKeyword) ||
             description.includes(lowerKeyword)
    })
  }

  // ==================== AI 对话相关方法 ====================

  /**
   * 保存对话
   */
  async saveConversation(conversation: AIConversation): Promise<number> {
    const data = {
      ...conversation,
      updatedAt: new Date()
    }
    return await this.save(AI_CONVERSATION_STORE, data) as number
  }

  /**
   * 获取对话
   */
  async getConversation(id: number): Promise<ConversationRecord | null> {
    return await this.get<ConversationRecord>(AI_CONVERSATION_STORE, id)
  }

  /**
   * 获取所有对话（按更新时间倒序）
   */
  async getAllConversations(): Promise<ConversationRecord[]> {
    const conversations = await this.getByIndexRange<ConversationRecord>(
      AI_CONVERSATION_STORE,
      'updatedAt',
      undefined,
      'prev' // 倒序
    )
    return conversations
  }

  /**
   * 删除对话
   */
  async deleteConversation(id: number): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [AI_CONVERSATION_STORE, AI_MESSAGE_STORE],
        'readwrite'
      )

      // 删除对话
      const conversationStore = transaction.objectStore(AI_CONVERSATION_STORE)
      conversationStore.delete(id)

      // 删除对话的所有消息
      const messageStore = transaction.objectStore(AI_MESSAGE_STORE)
      const index = messageStore.index('conversationId')
      const request = index.openCursor(IDBKeyRange.only(id))

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => {
        console.log(`🗑️ 已删除对话 #${id} 及其所有消息`)
        resolve()
      }

      transaction.onerror = () => {
        console.error('删除对话失败:', transaction.error)
        reject(transaction.error)
      }
    })
  }

  // ==================== AI 消息相关方法 ====================

  /**
   * 保存消息
   */
  async saveMessage(message: AIMessage): Promise<number> {
    return await this.save(AI_MESSAGE_STORE, message) as number
  }

  /**
   * 获取对话的所有消息
   */
  async getMessagesByConversation(conversationId: number): Promise<MessageRecord[]> {
    const messages = await this.getByIndex<MessageRecord>(
      AI_MESSAGE_STORE,
      'conversationId',
      conversationId
    )

    // 按时间戳排序
    return messages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeA - timeB
    })
  }

  /**
   * 删除消息
   */
  async deleteMessage(id: number): Promise<void> {
    await this.delete(AI_MESSAGE_STORE, id)
  }

  /**
   * 批量删除消息
   */
  async deleteMessages(ids: number[]): Promise<void> {
    await this.deleteMany(AI_MESSAGE_STORE, ids)
  }

  /**
   * 清空对话的所有消息
   */
  async clearConversationMessages(conversationId: number): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_MESSAGE_STORE], 'readwrite')
      const store = transaction.objectStore(AI_MESSAGE_STORE)
      const index = store.index('conversationId')
      const request = index.openCursor(IDBKeyRange.only(conversationId))

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => {
        console.log(`🗑️ 已清空对话 #${conversationId} 的所有消息`)
        resolve()
      }

      transaction.onerror = () => {
        console.error('清空消息失败:', transaction.error)
        reject(transaction.error)
      }
    })
  }

  // ==================== 配置相关方法 ====================

  /**
   * 保存配置
   */
  async saveConfig(key: string, value: any): Promise<void> {
    const data = {
      key,
      value,
      updatedAt: new Date()
    }
    await this.save(AI_CONFIG_STORE, data)
  }

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<any> {
    const record = await this.get<{ key: string; value: any }>(AI_CONFIG_STORE, key)
    return record?.value || null
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    await this.delete(AI_CONFIG_STORE, key)
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<Record<string, any>> {
    const records = await this.getAll<{ key: string; value: any }>(AI_CONFIG_STORE)
    const result: Record<string, any> = {}
    records.forEach(record => {
      result[record.key] = record.value
    })
    return result
  }

  // ==================== LLM 配置相关方法 ====================

  /**
   * 保存 LLM 配置
   */
  async saveLLMConfig(config: LLMConfig): Promise<void> {
    await this.saveConfig('llm_config', config)
  }

  /**
   * 获取 LLM 配置
   */
  async getLLMConfig(): Promise<LLMConfig | null> {
    return await this.getConfig('llm_config')
  }

  /**
   * 保存使用统计
   */
  async saveUsageStats(stats: any): Promise<void> {
    await this.saveConfig('usage_stats', stats)
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(): Promise<any> {
    return await this.getConfig('usage_stats')
  }

  /**
   * 清空所有 AI 数据
   */
  async clearAllAIData(): Promise<void> {
    await this.clearAll()
  }
}

/**
 * 导出单例
 */
export const aiDB = new AIDatabase()