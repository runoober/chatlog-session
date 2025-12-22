/**
 * 批量选择状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Message } from '@/types'

export const useBatchSelectionStore = defineStore('batch-selection', () => {
  // ==================== State ====================

  /**
   * 批量选择模式是否激活
   */
  const isActive = ref<boolean>(false)

  /**
   * 已选中的消息 ID 列表
   */
  const selectedMessageIds = ref<Set<number>>(new Set())

  /**
   * 已选中的消息对象列表
   */
  const selectedMessages = ref<Map<number, Message>>(new Map())

  /**
   * 选择模式类型
   */
  const selectionMode = ref<'messages' | 'sessions'>('messages')

  // ==================== Getters ====================

  /**
   * 已选中消息数量
   */
  const selectedCount = computed(() => selectedMessageIds.value.size)

  /**
   * 是否有选中的消息
   */
  const hasSelection = computed(() => selectedMessageIds.value.size > 0)

  /**
   * 检查消息是否已选中
   */
  const isSelected = (messageId: number): boolean => {
    return selectedMessageIds.value.has(messageId)
  }

  /**
   * 获取所有选中的消息
   */
  const getSelectedMessages = computed(() => {
    return Array.from(selectedMessages.value.values())
  })

  /**
   * 获取选中消息的内容文本
   */
  const getSelectedTexts = computed(() => {
    return Array.from(selectedMessages.value.values())
      .map(msg => msg.content)
      .filter(content => content && content.trim())
  })

  // ==================== Actions ====================

  /**
   * 激活批量选择模式
   */
  function activate(mode: 'messages' | 'sessions' = 'messages') {
    isActive.value = true
    selectionMode.value = mode
    
    // 清空之前的选择
    clear()
  }

  /**
   * 退出批量选择模式
   */
  function deactivate() {
    isActive.value = false
    clear()
  }

  /**
   * 切换批量选择模式
   */
  function toggle() {
    if (isActive.value) {
      deactivate()
    } else {
      activate()
    }
  }

  /**
   * 选中一条消息
   */
  function selectMessage(message: Message) {
    selectedMessageIds.value.add(message.id)
    selectedMessages.value.set(message.id, message)
  }

  /**
   * 取消选中一条消息
   */
  function deselectMessage(messageId: number) {
    selectedMessageIds.value.delete(messageId)
    selectedMessages.value.delete(messageId)
  }

  /**
   * 切换消息选中状态
   */
  function toggleMessage(message: Message) {
    if (isSelected(message.id)) {
      deselectMessage(message.id)
    } else {
      selectMessage(message)
    }
  }

  /**
   * 批量选中消息
   */
  function selectMessages(messages: Message[]) {
    messages.forEach(message => {
      selectedMessageIds.value.add(message.id)
      selectedMessages.value.set(message.id, message)
    })
  }

  /**
   * 批量取消选中
   */
  function deselectMessages(messageIds: number[]) {
    messageIds.forEach(id => {
      selectedMessageIds.value.delete(id)
      selectedMessages.value.delete(id)
    })
  }

  /**
   * 全选
   */
  function selectAll(messages: Message[]) {
    selectMessages(messages)
  }

  /**
   * 反选
   */
  function invertSelection(allMessages: Message[]) {
    const newSelectedIds = new Set<number>()
    const newSelectedMessages = new Map<number, Message>()

    allMessages.forEach(message => {
      if (!isSelected(message.id)) {
        newSelectedIds.add(message.id)
        newSelectedMessages.set(message.id, message)
      }
    })

    selectedMessageIds.value = newSelectedIds
    selectedMessages.value = newSelectedMessages
  }

  /**
   * 清空选择
   */
  function clear() {
    selectedMessageIds.value.clear()
    selectedMessages.value.clear()
  }

  /**
   * 选择范围内的消息（从 fromId 到 toId）
   */
  function selectRange(messages: Message[], fromId: number, toId: number) {
    const fromIndex = messages.findIndex(m => m.id === fromId)
    const toIndex = messages.findIndex(m => m.id === toId)

    if (fromIndex === -1 || toIndex === -1) return

    const startIndex = Math.min(fromIndex, toIndex)
    const endIndex = Math.max(fromIndex, toIndex)

    const rangeMessages = messages.slice(startIndex, endIndex + 1)
    selectMessages(rangeMessages)
  }

  /**
   * 按条件筛选并选中消息
   */
  function selectByCondition(
    messages: Message[],
    condition: (message: Message) => boolean
  ) {
    const matchedMessages = messages.filter(condition)
    selectMessages(matchedMessages)
  }

  /**
   * 选择包含特定关键词的消息
   */
  function selectByKeyword(messages: Message[], keyword: string) {
    selectByCondition(messages, message => {
      return message.content?.toLowerCase().includes(keyword.toLowerCase())
    })
  }

  /**
   * 选择特定发送者的消息
   */
  function selectBySender(messages: Message[], sender: string) {
    selectByCondition(messages, message => message.sender === sender)
  }

  /**
   * 选择特定类型的消息
   */
  function selectByType(messages: Message[], type: number) {
    selectByCondition(messages, message => message.type === type)
  }

  /**
   * 导出选中的消息为文本
   */
  function exportAsText(): string {
    const messages = getSelectedMessages.value
    
    return messages
      .map(msg => {
        const time = new Date(msg.time).toLocaleString('zh-CN')
        const sender = msg.senderName || msg.sender
        const content = msg.content || '[非文本消息]'
        return `[${time}] ${sender}: ${content}`
      })
      .join('\n')
  }

  /**
   * 导出选中的消息为 JSON
   */
  function exportAsJSON(): string {
    const messages = getSelectedMessages.value
    return JSON.stringify(messages, null, 2)
  }

  /**
   * 复制选中的消息到剪贴板
   */
  async function copyToClipboard(): Promise<boolean> {
    try {
      const text = exportAsText()
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('复制到剪贴板失败:', error)
      return false
    }
  }

  /**
   * 获取选中消息的统计信息
   */
  const getStatistics = computed(() => {
    const messages = getSelectedMessages.value
    
    // 统计消息类型
    const typeCount: Record<number, number> = {}
    messages.forEach(msg => {
      typeCount[msg.type] = (typeCount[msg.type] || 0) + 1
    })

    // 统计发送者
    const senderCount: Record<string, number> = {}
    messages.forEach(msg => {
      const sender = msg.senderName || msg.sender
      senderCount[sender] = (senderCount[sender] || 0) + 1
    })

    // 统计时间范围
    const times = messages.map(msg => new Date(msg.time).getTime())
    const minTime = times.length > 0 ? Math.min(...times) : 0
    const maxTime = times.length > 0 ? Math.max(...times) : 0

    return {
      count: messages.length,
      typeCount,
      senderCount,
      timeRange: {
        start: minTime > 0 ? new Date(minTime) : null,
        end: maxTime > 0 ? new Date(maxTime) : null
      }
    }
  })

  return {
    // State
    isActive,
    selectedMessageIds,
    selectedMessages,
    selectionMode,

    // Getters
    selectedCount,
    hasSelection,
    isSelected,
    getSelectedMessages,
    getSelectedTexts,
    getStatistics,

    // Actions
    activate,
    deactivate,
    toggle,
    selectMessage,
    deselectMessage,
    toggleMessage,
    selectMessages,
    deselectMessages,
    selectAll,
    invertSelection,
    clear,
    selectRange,
    selectByCondition,
    selectByKeyword,
    selectBySender,
    selectByType,
    exportAsText,
    exportAsJSON,
    copyToClipboard
  }
})