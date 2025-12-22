/**
 * AI 对话状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  AIConversation,
  ConversationRecord,
  AIMessage,
  MessageRecord,
  ChatOptions,
  ContextInfo
} from '@/types/ai'
import { aiDB } from '@/utils/ai-db'
import { createMCPClient, type MCPClientConfig } from '@/api/ai/mcp-client'
import { useLLMConfigStore } from './llm-config'

export const useAIConversationStore = defineStore('ai-conversation', () => {
  // ==================== State ====================

  /**
   * 所有对话
   */
  const conversations = ref<ConversationRecord[]>([])

  /**
   * 当前对话
   */
  const currentConversation = ref<ConversationRecord | null>(null)

  /**
   * 当前对话的消息
   */
  const currentMessages = ref<MessageRecord[]>([])

  /**
   * 连接状态
   */
  const isConnected = ref<boolean>(false)

  /**
   * 处理状态
   */
  const isProcessing = ref<boolean>(false)

  /**
   * 流式响应的临时内容
   */
  const streamingContent = ref<string>('')

  /**
   * 当前上下文信息
   */
  const currentContext = ref<ContextInfo | null>(null)

  /**
   * 错误信息
   */
  const error = ref<string | null>(null)

  // ==================== Getters ====================

  /**
   * 是否有活动对话
   */
  const hasActiveConversation = computed((): boolean => {
    return currentConversation.value !== null
  })

  /**
   * 当前对话的消息数量
   */
  const messageCount = computed((): number => {
    return currentMessages.value.length
  })

  /**
   * 当前对话的总 Token 数
   */
  const totalTokens = computed((): number => {
    return currentMessages.value.reduce((sum, msg) => {
      return sum + (msg.tokenUsage?.input || 0) + (msg.tokenUsage?.output || 0)
    }, 0)
  })

  /**
   * 当前对话的总成本
   */
  const totalCost = computed((): number => {
    return currentMessages.value.reduce((sum, msg) => {
      return sum + (msg.tokenUsage?.cost || 0)
    }, 0)
  })

  /**
   * 最后一条消息
   */
  const lastMessage = computed((): MessageRecord | null => {
    return currentMessages.value[currentMessages.value.length - 1] || null
  })

  /**
   * 用户消息列表
   */
  const userMessages = computed((): MessageRecord[] => {
    return currentMessages.value.filter(m => m.role === 'user')
  })

  /**
   * AI 消息列表
   */
  const assistantMessages = computed((): MessageRecord[] => {
    return currentMessages.value.filter(m => m.role === 'assistant')
  })

  // ==================== Actions ====================

  /**
   * 加载所有对话
   */
  async function loadConversations(): Promise<void> {
    try {
      const allConversations = await aiDB.getAllConversations()
      conversations.value = allConversations
      console.log(`✅ 加载了 ${allConversations.length} 个对话`)
    } catch (err: any) {
      console.error('加载对话失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 创建新对话
   */
  async function createConversation(title?: string): Promise<number> {
    try {
      const newConversation: AIConversation = {
        title: title || `对话 ${new Date().toLocaleString()}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const id = await aiDB.saveConversation(newConversation)
      await loadConversations()
      
      // 设置为当前对话
      const conversation = conversations.value.find(c => c.id === id)
      if (conversation) {
        await setCurrentConversation(conversation)
      }

      console.log(`✅ 创建新对话 #${id}`)
      return id
    } catch (err: any) {
      console.error('创建对话失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 设置当前对话
   */
  async function setCurrentConversation(conversation: ConversationRecord | null): Promise<void> {
    currentConversation.value = conversation
    
    if (conversation) {
      await loadMessages(conversation.id!)
    } else {
      currentMessages.value = []
    }
  }

  /**
   * 加载对话的消息
   */
  async function loadMessages(conversationId: number): Promise<void> {
    try {
      const messages = await aiDB.getConversationMessages(conversationId)
      currentMessages.value = messages
      console.log(`✅ 加载了 ${messages.length} 条消息`)
    } catch (err: any) {
      console.error('加载消息失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(
    content: string,
    context?: ContextInfo
  ): Promise<void> {
    if (!currentConversation.value) {
      throw new Error('没有活动对话')
    }

    if (isProcessing.value) {
      throw new Error('正在处理中，请稍候')
    }

    isProcessing.value = true
    error.value = null
    streamingContent.value = ''

    try {
      const llmConfig = useLLMConfigStore()

      // 创建用户消息
      const userMessage: AIMessage = {
        conversationId: currentConversation.value.id!,
        role: 'user',
        content,
        context,
        timestamp: new Date(),
        status: 'success'
      }

      // 保存用户消息
      const userMsgId = await aiDB.saveMessage(userMessage)
      userMessage.id = userMsgId
      currentMessages.value.push(userMessage as MessageRecord)

      // 创建 AI 消息占位符
      const assistantMessage: AIMessage = {
        conversationId: currentConversation.value.id!,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'streaming'
      }

      const assistantMsgId = await aiDB.saveMessage(assistantMessage)
      assistantMessage.id = assistantMsgId
      currentMessages.value.push(assistantMessage as MessageRecord)

      // 准备聊天选项
      const chatOptions: ChatOptions = {
        messages: currentMessages.value
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role,
            content: m.content,
            context: m.context
          })),
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        stream: true
      }

      // 创建 MCP 客户端
      const clientConfig: MCPClientConfig = {
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl || llmConfig.getDefaultBaseUrl
      }

      const client = createMCPClient(clientConfig)

      // 流式接收响应
      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0

      await client.streamChat(chatOptions, (chunk) => {
        if (chunk.finished) {
          // 流式结束
          assistantMessage.content = fullContent
          assistantMessage.status = 'success'
          
          if (chunk.usage) {
            inputTokens = chunk.usage.inputTokens
            outputTokens = chunk.usage.outputTokens
            
            // 计算成本
            const cost = llmConfig.estimateCost(inputTokens, outputTokens)
            
            assistantMessage.tokenUsage = {
              input: inputTokens,
              output: outputTokens,
              cost
            }

            // 追踪使用量
            llmConfig.trackUsage(inputTokens, outputTokens)
          }

          // 保存最终消息
          aiDB.saveMessage(assistantMessage as MessageRecord)

          // 更新对话
          if (currentConversation.value) {
            currentConversation.value.updatedAt = new Date()
            currentConversation.value.totalTokens = (currentConversation.value.totalTokens || 0) + inputTokens + outputTokens
            currentConversation.value.totalCost = (currentConversation.value.totalCost || 0) + (assistantMessage.tokenUsage?.cost || 0)
            aiDB.saveConversation(currentConversation.value)
          }

          streamingContent.value = ''
          isProcessing.value = false
          
        } else {
          // 接收流式内容
          fullContent += chunk.delta
          streamingContent.value = fullContent
          
          // 更新消息显示
          const msgIndex = currentMessages.value.findIndex(m => m.id === assistantMsgId)
          if (msgIndex >= 0) {
            currentMessages.value[msgIndex].content = fullContent
          }
        }
      })

    } catch (err: any) {
      console.error('发送消息失败:', err)
      error.value = err.message
      
      // 更新消息状态为错误
      if (currentMessages.value.length > 0) {
        const lastMsg = currentMessages.value[currentMessages.value.length - 1]
        if (lastMsg.role === 'assistant') {
          lastMsg.status = 'error'
          lastMsg.error = err.message
          await aiDB.saveMessage(lastMsg)
        }
      }
      
      isProcessing.value = false
      throw err
    }
  }

  /**
   * 重试最后一条消息
   */
  async function retryLastMessage(): Promise<void> {
    if (currentMessages.value.length < 2) {
      throw new Error('没有可重试的消息')
    }

    // 删除最后一条 AI 消息
    const lastMsg = currentMessages.value.pop()
    if (lastMsg?.id) {
      await aiDB.deleteMessage(lastMsg.id)
    }

    // 获取最后一条用户消息
    const lastUserMsg = currentMessages.value[currentMessages.value.length - 1]
    if (lastUserMsg?.role === 'user') {
      // 删除用户消息
      currentMessages.value.pop()
      if (lastUserMsg.id) {
        await aiDB.deleteMessage(lastUserMsg.id)
      }
      
      // 重新发送
      await sendMessage(lastUserMsg.content, lastUserMsg.context)
    }
  }

  /**
   * 删除消息
   */
  async function deleteMessage(messageId: number): Promise<void> {
    try {
      await aiDB.deleteMessage(messageId)
      currentMessages.value = currentMessages.value.filter(m => m.id !== messageId)
      console.log(`✅ 删除消息 #${messageId}`)
    } catch (err: any) {
      console.error('删除消息失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 删除对话
   */
  async function deleteConversation(conversationId: number): Promise<void> {
    try {
      await aiDB.deleteConversation(conversationId)
      await loadConversations()
      
      // 如果删除的是当前对话，清空当前对话
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value = null
        currentMessages.value = []
      }
      
      console.log(`✅ 删除对话 #${conversationId}`)
    } catch (err: any) {
      console.error('删除对话失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 更新对话标题
   */
  async function updateConversationTitle(conversationId: number, title: string): Promise<void> {
    try {
      const conversation = conversations.value.find(c => c.id === conversationId)
      if (!conversation) {
        throw new Error('对话不存在')
      }

      conversation.title = title
      conversation.updatedAt = new Date()
      await aiDB.saveConversation(conversation)
      
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value.title = title
      }
      
      console.log(`✅ 更新对话标题 #${conversationId}`)
    } catch (err: any) {
      console.error('更新对话标题失败:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * 设置上下文
   */
  function setContext(context: ContextInfo | null): void {
    currentContext.value = context
  }

  /**
   * 清除上下文
   */
  function clearContext(): void {
    currentContext.value = null
  }

  /**
   * 导出对话为 Markdown
   */
  function exportConversationAsMarkdown(conversationId?: number): string {
    const conversation = conversationId 
      ? conversations.value.find(c => c.id === conversationId)
      : currentConversation.value

    if (!conversation) {
      throw new Error('对话不存在')
    }

    const messages = conversationId
      ? [] // 需要加载消息
      : currentMessages.value

    let markdown = `# ${conversation.title}\n\n`
    markdown += `创建时间：${new Date(conversation.createdAt).toLocaleString()}\n`
    markdown += `更新时间：${new Date(conversation.updatedAt).toLocaleString()}\n\n`
    markdown += `---\n\n`

    for (const msg of messages) {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI'
      const time = new Date(msg.timestamp).toLocaleString()
      
      markdown += `## ${role} - ${time}\n\n`
      markdown += `${msg.content}\n\n`
      
      if (msg.tokenUsage) {
        markdown += `*Token: ${msg.tokenUsage.input + msg.tokenUsage.output} | 成本: $${msg.tokenUsage.cost.toFixed(4)}*\n\n`
      }
      
      markdown += `---\n\n`
    }

    if (conversation.totalTokens) {
      markdown += `**总计 Token**: ${conversation.totalTokens}\n`
    }
    if (conversation.totalCost) {
      markdown += `**总计成本**: $${conversation.totalCost.toFixed(4)}\n`
    }

    return markdown
  }

  /**
   * 测试连接
   */
  async function testConnection(): Promise<boolean> {
    try {
      const llmConfig = useLLMConfigStore()
      
      const clientConfig: MCPClientConfig = {
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl || llmConfig.getDefaultBaseUrl
      }

      const client = createMCPClient(clientConfig)
      const result = await client.testConnection()
      
      isConnected.value = result
      return result
    } catch (err: any) {
      console.error('连接测试失败:', err)
      isConnected.value = false
      error.value = err.message
      return false
    }
  }

  /**
   * 清除错误
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await loadConversations()
  }

  return {
    // State
    conversations,
    currentConversation,
    currentMessages,
    isConnected,
    isProcessing,
    streamingContent,
    currentContext,
    error,

    // Getters
    hasActiveConversation,
    messageCount,
    totalTokens,
    totalCost,
    lastMessage,
    userMessages,
    assistantMessages,

    // Actions
    loadConversations,
    createConversation,
    setCurrentConversation,
    loadMessages,
    sendMessage,
    retryLastMessage,
    deleteMessage,
    deleteConversation,
    updateConversationTitle,
    setContext,
    clearContext,
    exportConversationAsMarkdown,
    testConnection,
    clearError,
    init
  }
})