/**
 * AI 功能 IndexedDB 工具类
 * 用于管理提示词、对话历史和配置
 */

import type { 
  Prompt, 
  PromptRecord, 
  AIConversation, 
  ConversationRecord,
  AIMessage, 
  MessageRecord,
  ConfigRecord,
  LLMConfig
} from '@/types/ai'

const DB_NAME = 'ChatlogSessionDB'
const DB_VERSION = 4
const PROMPT_STORE = 'prompts'
const AI_CONVERSATION_STORE = 'ai_conversations'
const AI_MESSAGE_STORE = 'ai_messages'
const AI_CONFIG_STORE = 'ai_config'

/**
 * AI 数据库管理类
 */
class AIDatabase {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null

  /**
   * 初始化数据库
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('AI IndexedDB 打开失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ AI IndexedDB 初始化成功')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion

        console.log(`AI 数据库升级 v${oldVersion} → v${DB_VERSION}`)

        // 创建提示词对象存储
        if (!db.objectStoreNames.contains(PROMPT_STORE)) {
          const promptStore = db.createObjectStore(PROMPT_STORE, { keyPath: 'id', autoIncrement: true })
          
          promptStore.createIndex('category', 'category', { unique: false })
          promptStore.createIndex('createdAt', 'createdAt', { unique: false })
          promptStore.createIndex('updatedAt', 'updatedAt', { unique: false })
          promptStore.createIndex('isFavorite', 'isFavorite', { unique: false })
          promptStore.createIndex('isBuiltIn', 'isBuiltIn', { unique: false })
          console.log('✅ 创建 prompts 存储')
        }

        // 创建 AI 对话对象存储
        if (!db.objectStoreNames.contains(AI_CONVERSATION_STORE)) {
          const conversationStore = db.createObjectStore(AI_CONVERSATION_STORE, { keyPath: 'id', autoIncrement: true })
          
          conversationStore.createIndex('createdAt', 'createdAt', { unique: false })
          conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false })
          console.log('✅ 创建 ai_conversations 存储')
        }

        // 创建 AI 消息对象存储
        if (!db.objectStoreNames.contains(AI_MESSAGE_STORE)) {
          const messageStore = db.createObjectStore(AI_MESSAGE_STORE, { keyPath: 'id', autoIncrement: true })
          
          messageStore.createIndex('conversationId', 'conversationId', { unique: false })
          messageStore.createIndex('role', 'role', { unique: false })
          messageStore.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('✅ 创建 ai_messages 存储')
        }

        // 创建 AI 配置对象存储
        if (!db.objectStoreNames.contains(AI_CONFIG_STORE)) {
          db.createObjectStore(AI_CONFIG_STORE, { keyPath: 'key' })
          console.log('✅ 创建 ai_config 存储')
        }
      }
    })

    return this.initPromise
  }

  /**
   * 获取数据库实例
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    return this.db!
  }

  // ==================== 提示词相关方法 ====================

  /**
   * 保存提示词
   */
  async savePrompt(prompt: Prompt): Promise<number> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE], 'readwrite')
      const store = transaction.objectStore(PROMPT_STORE)
      
      const data = {
        ...prompt,
        updatedAt: new Date()
      }
      
      const request = prompt.id ? store.put(data) : store.add(data)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取提示词
   */
  async getPrompt(id: number): Promise<PromptRecord | null> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE], 'readonly')
      const store = transaction.objectStore(PROMPT_STORE)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取所有提示词
   */
  async getAllPrompts(): Promise<PromptRecord[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE], 'readonly')
      const store = transaction.objectStore(PROMPT_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 按分类获取提示词
   */
  async getPromptsByCategory(category: string): Promise<PromptRecord[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE], 'readonly')
      const store = transaction.objectStore(PROMPT_STORE)
      const index = store.index('category')
      const request = index.getAll(category)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 删除提示词
   */
  async deletePrompt(id: number): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROMPT_STORE], 'readwrite')
      const store = transaction.objectStore(PROMPT_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 更新提示词使用次数
   */
  async incrementPromptUsage(id: number): Promise<void> {
    const prompt = await this.getPrompt(id)
    if (prompt) {
      prompt.usageCount = (prompt.usageCount || 0) + 1
      await this.savePrompt(prompt)
    }
  }

  /**
   * 搜索提示词
   */
  async searchPrompts(keyword: string): Promise<PromptRecord[]> {
    const allPrompts = await this.getAllPrompts()
    const lowerKeyword = keyword.toLowerCase()
    
    return allPrompts.filter(prompt => {
      const title = prompt.title?.toLowerCase() || ''
      const content = prompt.content?.toLowerCase() || ''
      const description = prompt.description?.toLowerCase() || ''
      
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
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONVERSATION_STORE], 'readwrite')
      const store = transaction.objectStore(AI_CONVERSATION_STORE)
      
      const data = {
        ...conversation,
        updatedAt: new Date()
      }
      
      const request = conversation.id ? store.put(data) : store.add(data)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取对话
   */
  async getConversation(id: number): Promise<ConversationRecord | null> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONVERSATION_STORE], 'readonly')
      const store = transaction.objectStore(AI_CONVERSATION_STORE)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取所有对话（按更新时间倒序）
   */
  async getAllConversations(): Promise<ConversationRecord[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONVERSATION_STORE], 'readonly')
      const store = transaction.objectStore(AI_CONVERSATION_STORE)
      const index = store.index('updatedAt')
      const request = index.openCursor(null, 'prev')
      const results: ConversationRecord[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 删除对话（同时删除所有消息）
   */
  async deleteConversation(id: number): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONVERSATION_STORE, AI_MESSAGE_STORE], 'readwrite')
      
      // 删除对话
      const conversationStore = transaction.objectStore(AI_CONVERSATION_STORE)
      conversationStore.delete(id)
      
      // 删除对话的所有消息
      const messageStore = transaction.objectStore(AI_MESSAGE_STORE)
      const index = messageStore.index('conversationId')
      const request = index.openCursor(IDBKeyRange.only(id))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== AI 消息相关方法 ====================

  /**
   * 保存消息
   */
  async saveMessage(message: AIMessage): Promise<number> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_MESSAGE_STORE], 'readwrite')
      const store = transaction.objectStore(AI_MESSAGE_STORE)
      
      const request = message.id ? store.put(message) : store.add(message)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取对话的所有消息
   */
  async getConversationMessages(conversationId: number): Promise<MessageRecord[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_MESSAGE_STORE], 'readonly')
      const store = transaction.objectStore(AI_MESSAGE_STORE)
      const index = store.index('conversationId')
      const request = index.getAll(conversationId)

      request.onsuccess = () => {
        const messages = request.result || []
        // 按时间排序
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        resolve(messages)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 删除消息
   */
  async deleteMessage(id: number): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_MESSAGE_STORE], 'readwrite')
      const store = transaction.objectStore(AI_MESSAGE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 批量保存消息
   */
  async saveMessages(messages: AIMessage[]): Promise<number[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_MESSAGE_STORE], 'readwrite')
      const store = transaction.objectStore(AI_MESSAGE_STORE)
      const ids: number[] = []
      let completed = 0

      messages.forEach(message => {
        const request = message.id ? store.put(message) : store.add(message)
        
        request.onsuccess = () => {
          ids.push(request.result as number)
          completed++
          if (completed === messages.length) {
            resolve(ids)
          }
        }

        request.onerror = () => reject(request.error)
      })
    })
  }

  // ==================== AI 配置相关方法 ====================

  /**
   * 保存配置
   */
  async saveConfig(key: string, value: any): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONFIG_STORE], 'readwrite')
      const store = transaction.objectStore(AI_CONFIG_STORE)
      
      const data: ConfigRecord = {
        key,
        value,
        updatedAt: new Date()
      }
      
      const request = store.put(data)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<any> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONFIG_STORE], 'readonly')
      const store = transaction.objectStore(AI_CONFIG_STORE)
      const request = store.get(key)

      request.onsuccess = () => {
        const record = request.result as ConfigRecord | undefined
        resolve(record ? record.value : null)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONFIG_STORE], 'readwrite')
      const store = transaction.objectStore(AI_CONFIG_STORE)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<ConfigRecord[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AI_CONFIG_STORE], 'readonly')
      const store = transaction.objectStore(AI_CONFIG_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => reject(request.error)
    })
  }

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
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [PROMPT_STORE, AI_CONVERSATION_STORE, AI_MESSAGE_STORE, AI_CONFIG_STORE], 
        'readwrite'
      )

      transaction.objectStore(PROMPT_STORE).clear()
      transaction.objectStore(AI_CONVERSATION_STORE).clear()
      transaction.objectStore(AI_MESSAGE_STORE).clear()
      transaction.objectStore(AI_CONFIG_STORE).clear()

      transaction.oncomplete = () => {
        console.log('🗑️ 已清空所有 AI 数据')
        resolve()
      }

      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
      console.log('🔒 AI IndexedDB 已关闭')
    }
  }
}

/**
 * 导出单例
 */
export const aiDB = new AIDatabase()