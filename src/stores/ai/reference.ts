/**
 * 引用选择和上下文构建状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Reference,
  SessionReference,
  MessageReference,
  UserReference,
  TimeRangeReference,
  TimeRange,
  ContextInfo,
  ContextMessage,
  ContextBuildStrategy,
  PriorityRule
} from '@/types/ai'

export const useReferenceStore = defineStore('reference', () => {
  // ==================== State ====================

  /**
   * 当前所有引用
   */
  const currentReferences = ref<Reference[]>([])

  /**
   * 选中的会话 ID
   */
  const selectedSessions = ref<string[]>([])

  /**
   * 选中的消息 ID
   */
  const selectedMessages = ref<number[]>([])

  /**
   * 选中的用户
   */
  const selectedUsers = ref<string[]>([])

  /**
   * 时间范围
   */
  const timeRange = ref<TimeRange | null>(null)

  /**
   * 上下文构建策略
   */
  const buildStrategy = ref<ContextBuildStrategy>('smart')

  /**
   * 最大 Token 数
   */
  const maxTokens = ref<number>(8000)

  /**
   * 优先级规则
   */
  const priorityRules = ref<PriorityRule[]>([
    { type: 'keyword', weight: 2.0 },
    { type: 'user', weight: 1.5 },
    { type: 'time', weight: 1.2 },
    { type: 'engagement', weight: 1.0 }
  ])

  /**
   * 构建的上下文预览
   */
  const contextPreview = ref<string>('')

  /**
   * 估算的 Token 数
   */
  const estimatedTokens = ref<number>(0)

  // ==================== Getters ====================

  /**
   * 引用数量
   */
  const referenceCount = computed((): number => {
    return currentReferences.value.length
  })

  /**
   * 是否有引用
   */
  const hasReferences = computed((): boolean => {
    return currentReferences.value.length > 0
  })

  /**
   * 会话引用
   */
  const sessionReferences = computed((): SessionReference[] => {
    return currentReferences.value.filter(r => r.type === 'session') as SessionReference[]
  })

  /**
   * 消息引用
   */
  const messageReferences = computed((): MessageReference[] => {
    return currentReferences.value.filter(r => r.type === 'message') as MessageReference[]
  })

  /**
   * 用户引用
   */
  const userReferences = computed((): UserReference[] => {
    return currentReferences.value.filter(r => r.type === 'user') as UserReference[]
  })

  /**
   * 时间范围引用
   */
  const timeRangeReference = computed((): TimeRangeReference | null => {
    const ref = currentReferences.value.find(r => r.type === 'timeRange')
    return ref as TimeRangeReference || null
  })

  /**
   * 引用摘要
   */
  const referenceSummary = computed((): string => {
    const parts: string[] = []
    
    if (selectedSessions.value.length > 0) {
      parts.push(`${selectedSessions.value.length} 个会话`)
    }
    
    if (selectedMessages.value.length > 0) {
      parts.push(`${selectedMessages.value.length} 条消息`)
    }
    
    if (selectedUsers.value.length > 0) {
      parts.push(`${selectedUsers.value.length} 个用户`)
    }
    
    if (timeRange.value) {
      parts.push(`时间范围: ${timeRange.value.start} ~ ${timeRange.value.end}`)
    }
    
    return parts.join(', ') || '无引用'
  })

  /**
   * Token 使用率
   */
  const tokenUsageRate = computed((): number => {
    if (maxTokens.value === 0) return 0
    return Math.min(100, (estimatedTokens.value / maxTokens.value) * 100)
  })

  /**
   * 是否超出 Token 限制
   */
  const isOverTokenLimit = computed((): boolean => {
    return estimatedTokens.value > maxTokens.value
  })

  // ==================== Actions ====================

  /**
   * 添加会话引用
   */
  function addSessionReference(sessionId: string, sessionName: string, messageCount?: number): void {
    if (selectedSessions.value.includes(sessionId)) {
      return
    }

    selectedSessions.value.push(sessionId)

    const reference: SessionReference = {
      id: `session-${sessionId}`,
      type: 'session',
      label: sessionName,
      sessionId,
      sessionName,
      messageCount
    }

    currentReferences.value.push(reference)
  }

  /**
   * 移除会话引用
   */
  function removeSessionReference(sessionId: string): void {
    selectedSessions.value = selectedSessions.value.filter(id => id !== sessionId)
    currentReferences.value = currentReferences.value.filter(
      r => !(r.type === 'session' && (r as SessionReference).sessionId === sessionId)
    )
  }

  /**
   * 添加消息引用
   */
  function addMessageReferences(
    messageIds: number[],
    sessionId: string,
    preview?: string
  ): void {
    const newIds = messageIds.filter(id => !selectedMessages.value.includes(id))
    selectedMessages.value.push(...newIds)

    const reference: MessageReference = {
      id: `messages-${Date.now()}`,
      type: 'message',
      label: `${messageIds.length} 条消息`,
      messageIds,
      sessionId,
      preview
    }

    currentReferences.value.push(reference)
  }

  /**
   * 移除消息引用
   */
  function removeMessageReference(messageIds: number[]): void {
    selectedMessages.value = selectedMessages.value.filter(
      id => !messageIds.includes(id)
    )
    currentReferences.value = currentReferences.value.filter(
      r => !(r.type === 'message' && messageIds.some(id => 
        (r as MessageReference).messageIds.includes(id)
      ))
    )
  }

  /**
   * 添加用户引用
   */
  function addUserReference(wxid: string, displayName: string): void {
    if (selectedUsers.value.includes(wxid)) {
      return
    }

    selectedUsers.value.push(wxid)

    const reference: UserReference = {
      id: `user-${wxid}`,
      type: 'user',
      label: displayName,
      wxid,
      displayName
    }

    currentReferences.value.push(reference)
  }

  /**
   * 移除用户引用
   */
  function removeUserReference(wxid: string): void {
    selectedUsers.value = selectedUsers.value.filter(id => id !== wxid)
    currentReferences.value = currentReferences.value.filter(
      r => !(r.type === 'user' && (r as UserReference).wxid === wxid)
    )
  }

  /**
   * 设置时间范围
   */
  function setTimeRange(start: string, end: string): void {
    timeRange.value = { start, end }

    // 移除旧的时间范围引用
    currentReferences.value = currentReferences.value.filter(r => r.type !== 'timeRange')

    const reference: TimeRangeReference = {
      id: `timerange-${Date.now()}`,
      type: 'timeRange',
      label: `${start} ~ ${end}`,
      range: { start, end }
    }

    currentReferences.value.push(reference)
  }

  /**
   * 清除时间范围
   */
  function clearTimeRange(): void {
    timeRange.value = null
    currentReferences.value = currentReferences.value.filter(r => r.type !== 'timeRange')
  }

  /**
   * 移除引用
   */
  function removeReference(referenceId: string): void {
    const reference = currentReferences.value.find(r => r.id === referenceId)
    if (!reference) return

    switch (reference.type) {
      case 'session':
        removeSessionReference((reference as SessionReference).sessionId)
        break
      case 'message':
        removeMessageReference((reference as MessageReference).messageIds)
        break
      case 'user':
        removeUserReference((reference as UserReference).wxid)
        break
      case 'timeRange':
        clearTimeRange()
        break
    }
  }

  /**
   * 清除所有引用
   */
  function clearAllReferences(): void {
    currentReferences.value = []
    selectedSessions.value = []
    selectedMessages.value = []
    selectedUsers.value = []
    timeRange.value = null
    contextPreview.value = ''
    estimatedTokens.value = 0
  }

  /**
   * 构建上下文信息
   */
  function buildContextInfo(): ContextInfo {
    return {
      sessions: selectedSessions.value.length > 0 ? selectedSessions.value : undefined,
      messages: selectedMessages.value.length > 0 ? selectedMessages.value : undefined,
      users: selectedUsers.value.length > 0 ? selectedUsers.value : undefined,
      timeRange: timeRange.value || undefined,
      tokenCount: estimatedTokens.value,
      preview: contextPreview.value
    }
  }

  /**
   * 估算 Token 数
   */
  function estimateTokenCount(text: string): number {
    // 粗略估算：中文 1 字 ≈ 1.5 tokens，英文 1 词 ≈ 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    
    return Math.ceil(chineseChars * 1.5 + englishWords)
  }

  /**
   * 计算消息优先级分数
   */
  function calculatePriority(
    message: ContextMessage,
    keywords?: string[]
  ): number {
    let score = 1.0

    // 应用优先级规则
    for (const rule of priorityRules.value) {
      switch (rule.type) {
        case 'keyword': {
          if (keywords && keywords.some(kw => message.content.includes(kw))) {
            score *= rule.weight
          }
          break
        }
        
        case 'user': {
          if (selectedUsers.value.includes(message.senderName)) {
            score *= rule.weight
          }
          break
        }
        
        case 'time': {
          // 越新的消息分数越高
          const messageTime = new Date(message.time).getTime()
          const now = Date.now()
          const daysDiff = (now - messageTime) / (1000 * 60 * 60 * 24)
          if (daysDiff < 7) {
            score *= rule.weight
          }
          break
        }
        
        case 'engagement': {
          // 消息长度作为参与度指标
          if (message.content.length > 50) {
            score *= rule.weight
          }
          break
        }
      }
    }

    return score
  }

  /**
   * 智能采样
   */
  function smartSampling(
    messages: ContextMessage[],
    maxTokenLimit: number,
    keywords?: string[]
  ): ContextMessage[] {
    // 1. 计算每条消息的优先级分数
    const scored = messages.map(msg => ({
      message: msg,
      score: calculatePriority(msg, keywords)
    }))

    // 2. 按分数排序
    scored.sort((a, b) => b.score - a.score)

    // 3. 选择高分消息直到达到 Token 限制
    let totalTokens = 0
    const selected: ContextMessage[] = []

    for (const item of scored) {
      const content = formatMessageContent(item.message)
      const tokens = estimateTokenCount(content)
      
      if (totalTokens + tokens <= maxTokenLimit) {
        selected.push(item.message)
        totalTokens += tokens
      } else {
        break
      }
    }

    // 4. 按时间重新排序
    selected.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    estimatedTokens.value = totalTokens
    return selected
  }

  /**
   * 格式化消息内容
   */
  function formatMessageContent(message: ContextMessage): string {
    return `[${message.time}] ${message.senderName} (${message.sessionName}): ${message.content}`
  }

  /**
   * 构建上下文文本
   */
  async function buildContextText(
    messages: ContextMessage[]
  ): Promise<string> {
    const parts: string[] = []

    // 添加元信息
    if (selectedSessions.value.length > 0) {
      parts.push(`# 会话范围\n${selectedSessions.value.join(', ')}\n`)
    }

    if (timeRange.value) {
      parts.push(`# 时间范围\n${timeRange.value.start} ~ ${timeRange.value.end}\n`)
    }

    if (selectedUsers.value.length > 0) {
      parts.push(`# 相关用户\n${selectedUsers.value.join(', ')}\n`)
    }

    parts.push(`\n# 聊天记录\n`)

    // 应用构建策略
    let selectedMessages: ContextMessage[] = []

    switch (buildStrategy.value) {
      case 'smart': {
        selectedMessages = smartSampling(messages, maxTokens.value)
        break
      }
      
      case 'recent': {
        // 选择最新的消息
        selectedMessages = messages
          .slice(-100)
          .slice(0, Math.floor(maxTokens.value / 50))
        break
      }
      
      case 'random': {
        // 随机采样
        const sampleSize = Math.min(messages.length, Math.floor(maxTokens.value / 50))
        selectedMessages = messages
          .sort(() => Math.random() - 0.5)
          .slice(0, sampleSize)
        break
      }
      
      case 'hierarchical': {
        // 分层摘要（暂时使用智能采样代替）
        selectedMessages = smartSampling(messages, maxTokens.value)
        break
      }
      
      default: {
        selectedMessages = messages.slice(0, 100)
      }
    }

    // 格式化消息
    for (const msg of selectedMessages) {
      parts.push(formatMessageContent(msg))
    }

    const context = parts.join('\n')
    contextPreview.value = context.slice(0, 500) + (context.length > 500 ? '...' : '')
    estimatedTokens.value = estimateTokenCount(context)

    return context
  }

  /**
   * 设置构建策略
   */
  function setBuildStrategy(strategy: ContextBuildStrategy): void {
    buildStrategy.value = strategy
  }

  /**
   * 设置最大 Token 数
   */
  function setMaxTokens(tokens: number): void {
    maxTokens.value = tokens
  }

  /**
   * 设置优先级规则
   */
  function setPriorityRules(rules: PriorityRule[]): void {
    priorityRules.value = rules
  }

  /**
   * 快速选择：今天
   */
  function selectToday(): void {
    const today = new Date()
    const start = new Date(today.setHours(0, 0, 0, 0)).toISOString()
    const end = new Date(today.setHours(23, 59, 59, 999)).toISOString()
    setTimeRange(start, end)
  }

  /**
   * 快速选择：本周
   */
  function selectThisWeek(): void {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - dayOfWeek)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    
    setTimeRange(start.toISOString(), end.toISOString())
  }

  /**
   * 快速选择：本月
   */
  function selectThisMonth(): void {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    
    setTimeRange(start.toISOString(), end.toISOString())
  }

  /**
   * 快速选择：最近 N 天
   */
  function selectRecentDays(days: number): void {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    
    const start = new Date()
    start.setDate(start.getDate() - days)
    start.setHours(0, 0, 0, 0)
    
    setTimeRange(start.toISOString(), end.toISOString())
  }

  return {
    // State
    currentReferences,
    selectedSessions,
    selectedMessages,
    selectedUsers,
    timeRange,
    buildStrategy,
    maxTokens,
    priorityRules,
    contextPreview,
    estimatedTokens,

    // Getters
    referenceCount,
    hasReferences,
    sessionReferences,
    messageReferences,
    userReferences,
    timeRangeReference,
    referenceSummary,
    tokenUsageRate,
    isOverTokenLimit,

    // Actions
    addSessionReference,
    removeSessionReference,
    addMessageReferences,
    removeMessageReference,
    addUserReference,
    removeUserReference,
    setTimeRange,
    clearTimeRange,
    removeReference,
    clearAllReferences,
    buildContextInfo,
    estimateTokenCount,
    calculatePriority,
    smartSampling,
    formatMessageContent,
    buildContextText,
    setBuildStrategy,
    setMaxTokens,
    setPriorityRules,
    selectToday,
    selectThisWeek,
    selectThisMonth,
    selectRecentDays
  }
})