/**
 * 聊天消息状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatlogAPI, mediaAPI } from '@/api'
import type { Message } from '@/types/message'
import { createEmptyRangeMessage, createGapMessage, parseTimeRangeStart, parseTimeRangeEnd } from '@/types/message'
import type { SearchParams } from '@/types/api'
import { useAppStore } from './app'
import { useMessageCacheStore } from './messageCache'
import { useAutoRefreshStore } from './autoRefresh'
import { formatCSTRange } from '@/utils/timezone'
import { formatDateGroup, formatDate } from '@/utils/date'
import {
  getLatestMessageTime,
  getFirstMessageTime,
  fetchSmartHistoryMessages,
  deduplicateMessages,
  detectTimeGap,
  loadMessagesInTimeRange,
  handleEmptyResult,
  checkDataConnection,
  estimateMessageCount
} from './chat/utils'

export const useChatStore = defineStore('chat', () => {
  const appStore = useAppStore()
  const cacheStore = useMessageCacheStore()
  const refreshStore = useAutoRefreshStore()

  // 初始化缓存和自动刷新
  if (!cacheStore.metadata.length) {
    cacheStore.init()
  }
  if (refreshStore.config.enabled && !refreshStore.timer) {
    refreshStore.init()
  }

  // 监听缓存更新事件
  const handleCacheUpdate = (event: CustomEvent) => {
    if(appStore.isDebug){
      console.log('🛎️ Chatlog cache updated event received:', event.detail)
    }
    const { talker, messages: newMessages } = event.detail

    // 如果是当前打开的会话，更新消息列表
    if (talker === currentTalker.value) {
      // 找出新增的消息（基于 id 和 seq）
      const existingIds = new Set(messages.value.map(m => `${m.id}_${m.seq}`))
      const actualNewMessages = newMessages.filter((m: Message) => !existingIds.has(`${m.id}_${m.seq}`))

      if (actualNewMessages.length > 0) {
        // 只添加新消息到末尾
        messages.value = [...messages.value, ...actualNewMessages]

        if (appStore.isDebug) {
          console.log(`🔄 Auto-updated messages for current session: ${talker}`, {
            existingCount: messages.value.length - actualNewMessages.length,
            newMessagesCount: actualNewMessages.length
          })
        }
      }
    }
  }

  // 添加事件监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('chatlog-cache-updated', handleCacheUpdate as EventListener)
  }

  // ==================== State ====================

  /**
   * 消息列表
   */
  const messages = ref<Message[]>([])

  /**
   * 当前会话 ID
   */
  const currentTalker = ref<string>('')

  /**
   * 消息总数
   */
  const totalMessages = ref(0)

  /**
   * 当前页码
   */
  const currentPage = ref(1)

  /**
   * 每页大小
   */
  const pageSize = ref(appStore.config.pageSize)

  /**
   * 是否还有更多消息
   */
  const hasMore = ref(true)

  /**
   * 搜索关键词
   */
  const searchKeyword = ref('')

  /**
   * 搜索结果
   */
  const searchResults = ref<Message[]>([])

  /**
   * 选中的消息 ID 列表
   */
  const selectedMessageIds = ref<Set<number>>(new Set())

  /**
   * 正在播放的语音消息 ID
   */
  const playingVoiceId = ref<number | null>(null)

  /**
   * 消息加载状态
   */
  const loading = ref(false)

  /**
   * 搜索加载状态
   */
  const searchLoading = ref(false)

  /**
   * 错误信息
   */
  const error = ref<Error | null>(null)

  /**
   * 历史消息加载状态
   */
  const loadingHistory = ref(false)

  /**
   * 历史消息加载提示信息
   */
  const historyLoadMessage = ref('')

  // ==================== Getters ====================

  /**
   * 当前会话的消息列表
   */
  const currentMessages = computed(() => {
    if (!currentTalker.value) return []
    return messages.value.filter(msg => msg.talker === currentTalker.value)
  })

  /**
   * 按日期分组的消息, 返回一个对象数组
   * [{ date: '2023-11-11', formattedDate: '昨天', messages: [...] }]
   */
  const messagesByDate = computed(() => {
    const grouped: Record<string, { formattedDate: string, messages: Message[] }> = {}

    currentMessages.value.forEach(message => {
      // 优先使用 time（ISO 字符串），回退到 createTime（Unix 秒）
      const timestamp = message.time || message.createTime

      // 调试日志
      if (appStore.isDebug && !timestamp) {
        console.warn('⚠️ Message missing time fields:', {
          id: message.id,
          seq: message.seq,
          time: message.time,
          createTime: message.createTime,
        })
        return // 跳过没有时间戳的消息
      }

      // 解析日期对象
      const dateObj = typeof timestamp === 'string'
        ? new Date(timestamp)
        : new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)

      if (isNaN(dateObj.getTime())) {
        if (appStore.isDebug) {
          console.warn('⚠️ Invalid date format:', { timestamp, message })
        }
        return // 跳过无效日期的消息
      }

      const canonicalDate = formatDate(dateObj) // YYYY-MM-DD
      const formattedDate = formatDateGroup(timestamp)

      if (!grouped[canonicalDate]) {
        grouped[canonicalDate] = {
          formattedDate,
          messages: []
        }
      }
      grouped[canonicalDate].messages.push(message)
    })

    // 转换为数组并返回
    return Object.entries(grouped).map(([date, data]) => ({
      date,
      formattedDate: data.formattedDate,
      messages: data.messages
    }))
  })

  /**
   * 是否有选中的消息
   */
  const hasSelectedMessages = computed(() => selectedMessageIds.value.size > 0)

  /**
   * 选中的消息数量
   */
  const selectedCount = computed(() => selectedMessageIds.value.size)

  /**
   * 是否有搜索结果
   */
  const hasSearchResults = computed(() => searchResults.value.length > 0)

  /**
   * 媒体消息列表
   */
  const mediaMessages = computed(() => {
    return currentMessages.value.filter(msg => mediaAPI.isMediaMessage(msg.type))
  })

  /**
   * 图片消息列表
   */
  const imageMessages = computed(() => {
    return currentMessages.value.filter(msg => msg.type === 3)
  })

  /**
   * 视频消息列表
   */
  const videoMessages = computed(() => {
    return currentMessages.value.filter(msg => msg.type === 43)
  })

  /**
   * 文件消息列表
   */
  const fileMessages = computed(() => {
    return currentMessages.value.filter(msg => msg.type === 49)
  })

  // ==================== Actions ====================

  /**
   * 加载消息列表
   * 优先从缓存加载，如果没有缓存则从 API 加载并缓存
   */
  async function loadMessages(talker: string, page = 1, append = false, timeRange?: string, bottom = 0) {
    //如果 beforeTime 不包含 ~ , 则说明不是时间范围， 则需要补充成一个时间范围
    if (timeRange && !timeRange.includes('~')) {
      // 获取beforeTime 当天的 0 点
      const beforeDate = typeof timeRange === 'string'
        ? new Date(timeRange)
        : new Date(timeRange * 1000)
      const startOfDay = (new Date(beforeDate.getFullYear(), beforeDate.getMonth(), beforeDate.getDate()))
      // 获取beforeTime 当天的 23:59:59
      const endOfDay = timeRange

      timeRange = formatCSTRange(startOfDay, new Date(endOfDay))
    }
    try {
      loading.value = true
      error.value = null
      appStore.setLoading('messages', true)

      let result: Message[] = []
      const limit = pageSize.value

      // 第一页且没有时间过滤时，优先尝试从缓存加载
      if (page === 1 && !append) {
        const cached = cacheStore.get(talker)
        if (cached) {
          result = cached
          if (appStore.isDebug) {
            console.log('📦 Loaded from cache', { talker, count: result.length })
          }

          // 后台触发刷新（如果启用）
          if (refreshStore.config.enabled) {
            // 获取缓存中最新消息的时间（东八区 ISO 格式）
            const startFromTime = getLatestMessageTime(cached)
              //if(!timeRange || !startFromTime || timeRange > startFromTime)
            {

              if (appStore.isDebug) {
                console.log('⏳ Triggering background refresh for talker:', talker)
                console.log('📅 Start from time:', startFromTime)
              }

              refreshStore.refreshOne(talker, 1, startFromTime).catch(err => {
                console.error('Background refresh failed:', err)
              })
            }
          }
        }
      }

      // 如果没有缓存，从 API 加载
      if (result.length === 0) {
        const offset = (page - 1) * limit

        // 直接使用传入的时间字符串参数
        result = await chatlogAPI.getSessionMessages(talker, timeRange, limit, offset, bottom)

        // 第一页时保存到缓存
        if (page === 1 && !append) {
          cacheStore.set(talker, result)
        }
      }

      // 调试：输出第一条消息的时间信息
      if (result.length > 0) {
        const firstMsg = result[0]
        console.log('📝 First message debug:', {
          id: firstMsg.id,
          seq: firstMsg.seq,
          time: firstMsg.time,
          createTime: firstMsg.createTime,
          timeType: typeof firstMsg.time,
          createTimeType: typeof firstMsg.createTime,
          timeValid: firstMsg.time ? !isNaN(new Date(firstMsg.time).getTime()) : false,
          createTimeValid: firstMsg.createTime ? !isNaN(new Date(firstMsg.createTime * 1000).getTime()) : false,
        })
      }

      // 插入 EmptyRange 消息
      if ( timeRange && page === 1 && !append) {
        const suggestedBeforeTime = parseTimeRangeStart(timeRange)
        const newestMsgTime = getFirstMessageTime(result)

        const emptyRangeMessage = createEmptyRangeMessage(
          talker,
          timeRange,
          newestMsgTime,
          0, // triedTimes
          suggestedBeforeTime
        )

        if (appStore.isDebug) {
          console.log('📝 EmptyRange message created for empty load:', {
            talker,
            timeRange: timeRange,
            suggestedBeforeTime: new Date(suggestedBeforeTime).toISOString()
          })
        }

        result = [emptyRangeMessage, ...result ]
      }

      if (append) {
        messages.value = [...messages.value, ...result]
      } else {
        messages.value = result
        currentTalker.value = talker
      }

      currentPage.value = page
      hasMore.value = result.length >= limit && result.every(m => !m.isEmptyRange)

      if (appStore.isDebug) {
        console.log('💬 Messages loaded', {
          talker,
          page,
          count: result.length,
          hasMore: hasMore.value,
        })

      }

      return result
    } catch (err) {
      error.value = err as Error
      appStore.setError(err as Error)
      throw err
    } finally {
      loading.value = false
      appStore.setLoading('messages', false)
    }
  }

  /**
   * 加载更多消息
   */
  async function loadMoreMessages() {
    console.warn('loadMoreMessages called')
    if (!hasMore.value || loading.value || !currentTalker.value) {
      return
    }

    const nextPage = currentPage.value + 1
    await loadMessages(currentTalker.value, nextPage, true)
  }

  /**
   * 加载历史消息（下拉加载）
   * @param talker 会话 ID
   * @param beforeTime 最早消息的时间（ISO 8601 字符串或 Unix 秒时间戳）
   * @param offset 偏移量，用于同一时间范围内的分页
   * @returns 加载的历史消息列表和元数据
   */


  async function loadHistoryMessages(
    talker: string,
    beforeTime: string | number
   ): Promise<{ messages: Message[], hasMore: boolean, timeRange: string, offset: number }> {
    if (loadingHistory.value) {
      console.warn('History loading already in progress')
      return { messages: [], hasMore: false, timeRange: '', offset: 0 }
    }

    try {
      loadingHistory.value = true
      historyLoadMessage.value = ''
      appStore.setLoading('history', true)

      const limit = pageSize.value  // 使用配置的 pageSize

      let result: Message[] = []
      let finalTimeRange = ''
      let retryCount = 0

      // 使用智能策略获取消息
      const smartResult = await fetchSmartHistoryMessages(messages.value, talker, beforeTime, limit, 0, appStore.isDebug)
      result = smartResult.result
      finalTimeRange = smartResult.finalTimeRange
      retryCount = smartResult.retryCount

      // 如果返回空结果
      if (result.length === 0) {
        const emptyResult = handleEmptyResult(messages.value, talker, finalTimeRange, 0, retryCount, appStore.isDebug)
        if (emptyResult.newMessages && emptyResult.newMessages.length > 0) {
          messages.value = emptyResult.messages
        }
        return {
          messages: emptyResult.newMessages,
          hasMore: emptyResult.hasMore,
          timeRange: emptyResult.timeRange,
          offset: 0
        }
      }

      // 成功加载到消息
      if (appStore.isDebug) {
        console.log('✅ History messages loaded:', {
          count: result.length,
          timeRange: finalTimeRange
        })
      }

      // 消息去重
      const uniqueNewMessages = deduplicateMessages(messages.value, result, appStore.isDebug)

      // 判断是否还有更多历史消息
      // 如果返回的消息数等于 limit，说明该时间范围还有更多数据
      const hasMoreHistory = result.length >= limit

      // 如果满载，插入 Gap 消息到底部，标记更新的未加载数据
      // 如果满载，则不检测 EmptyRange（两者互斥）
      let gapToInsert: Message | null = null
      let emptyRangeToInsert: Message | null = null
      
      if (hasMoreHistory && uniqueNewMessages.length > 0) {
        // 检查新数据是否与已有数据衔接
        const isConnected = checkDataConnection(result, messages.value)
        
        if (!isConnected) {
          // 如果未衔接，才插入 Gap（标记更新的未加载数据）
          const requestedEndTime = parseTimeRangeEnd(finalTimeRange)
          const newestLoadedMsg = uniqueNewMessages[uniqueNewMessages.length - 1]
          const newestLoadedTime = newestLoadedMsg.time 
            ? new Date(newestLoadedMsg.time).getTime() 
            : newestLoadedMsg.createTime * 1000
          
          // 根据消息密度估算 Gap 范围内的消息数量
          const estimatedCount = estimateMessageCount(
            messages.value,
            talker,
            newestLoadedTime,
            requestedEndTime
          )
          
          // Gap 标记更新的未加载部分
          gapToInsert = createGapMessage(
            talker, 
            newestLoadedTime,
            requestedEndTime,
            estimatedCount
          )
          
          if (appStore.isDebug) {
            console.log('📌 Creating Gap message at bottom for newer data:', {
              newestLoaded: new Date(newestLoadedTime).toISOString(),
              requestedEnd: new Date(requestedEndTime).toISOString(),
              estimatedCount,
              actualLoaded: result.length
            })
          }
        } else {
          if (appStore.isDebug) {
            console.log('✅ New data is connected to existing data, no Gap needed')
          }
        }
      } else {
        // 如果未满载，检测时间间隙，插入 EmptyRange
        emptyRangeToInsert = detectTimeGap(talker, finalTimeRange, 0, uniqueNewMessages, appStore.isDebug)
      }

      // 插入消息到列表
      // EmptyRange 在顶部（未满载时），Gap 在底部（满载时），两者互斥
      const messagesToInsert: Message[] = []
      if (emptyRangeToInsert) {
        messagesToInsert.push(emptyRangeToInsert)
      }
      messagesToInsert.push(...uniqueNewMessages)
      if (gapToInsert) {
        messagesToInsert.push(gapToInsert)
      }
      messages.value = [...messagesToInsert, ...messages.value]

      // 清除提示信息
      historyLoadMessage.value = ''

      if (appStore.isDebug) {
        console.log('📊 History loading result:', {
          loaded: result.length,
          unique: uniqueNewMessages.length,
          hasMore: hasMoreHistory,
          gapInserted: !!gapToInsert,
          emptyRangeInserted: !!emptyRangeToInsert
        })
      }

      return {
        messages: uniqueNewMessages,
        hasMore: hasMoreHistory,
        timeRange: finalTimeRange,
        offset: 0
      }
    } catch (err) {
      error.value = err as Error
      appStore.setError(err as Error)
      historyLoadMessage.value = '加载历史消息失败，请重试'
      return { messages: [], hasMore: false, timeRange: '', offset: 0 }
    } finally {
      loadingHistory.value = false
      appStore.setLoading('history', false)
    }
  }



  /**
   * 刷新消息列表
   */
  /**
   * 加载 Gap 消息对应的历史数据
   */
  async function loadGapMessages(gapMessage: Message): Promise<{ success: boolean, hasMore: boolean }> {
    if (!gapMessage.isGap || !gapMessage.gapData) {
      console.warn('Invalid gap message')
      return { success: false, hasMore: false }
    }

    const { timeRange } = gapMessage.gapData
    const limit = pageSize.value

    if (appStore.isDebug) {
      console.log('🔄 Loading Gap messages:', {
        timeRange,
        gapId: gapMessage.id,
        limit
      })
    }

    try {
      // 移除当前 Gap 消息
      removeGapMessage(gapMessage.id)

      // 直接加载 Gap 标记的时间范围数据（使用 bottom=1 从末尾开始）
      const result = await loadMessagesInTimeRange(gapMessage.talker, timeRange, limit, 0)

      if (appStore.isDebug) {
        console.log('✅ Gap messages loaded:', {
          count: result.length,
          limit
        })
      }

      if (result.length === 0) {
        // 没有数据，不需要处理
        return { success: false, hasMore: false }
      }

      // 消息去重
      const uniqueNewMessages = deduplicateMessages(messages.value, result, appStore.isDebug)

      // 判断是否还有更多数据
      const hasMoreInGap = result.length >= limit

      // 如果还有更多数据，创建新的 Gap 消息到底部
      let newGapToInsert: Message | null = null
      if (hasMoreInGap && uniqueNewMessages.length > 0) {
        // 检查新数据是否与已有数据衔接
        const isConnected = checkDataConnection(result, messages.value)
        
        if (!isConnected) {
          const requestedEndTime = parseTimeRangeEnd(timeRange)
          const newestLoadedMsg = uniqueNewMessages[uniqueNewMessages.length - 1]
          const newestLoadedTime = newestLoadedMsg.time 
            ? new Date(newestLoadedMsg.time).getTime() 
            : newestLoadedMsg.createTime * 1000
          
          // 根据消息密度估算剩余消息数量
          const estimatedCount = estimateMessageCount(
            messages.value,
            gapMessage.talker,
            newestLoadedTime,
            requestedEndTime
          )
          
          // 创建新的 Gap 标记剩余未加载部分（底部）
          newGapToInsert = createGapMessage(
            gapMessage.talker, 
            newestLoadedTime,
            requestedEndTime,
            estimatedCount
          )
          
          if (appStore.isDebug) {
            console.log('📌 Creating new Gap at bottom for remaining data:', {
              newestLoaded: new Date(newestLoadedTime).toISOString(),
              requestedEnd: new Date(requestedEndTime).toISOString(),
              estimatedCount,
              actualLoaded: result.length
            })
          }
        } else {
          if (appStore.isDebug) {
            console.log('✅ Gap data is connected to existing data, no new Gap needed')
          }
        }
      }

      // 插入新加载的消息（和可能的新 Gap）到列表
      const messagesToInsert: Message[] = []
      messagesToInsert.push(...uniqueNewMessages)
      if (newGapToInsert) {
        messagesToInsert.push(newGapToInsert)
      }
      messages.value = [...messagesToInsert, ...messages.value]

      return {
        success: result.length > 0,
        hasMore: hasMoreInGap
      }
    } catch (err) {
      console.error('Gap messages loading failed:', err)
      // 加载失败，重新插入 Gap 消息
      const gapIndex = messages.value.findIndex(m => !m.isGap && !m.isEmptyRange)
      if (gapIndex !== -1) {
        messages.value.splice(gapIndex, 0, gapMessage)
      } else {
        messages.value.unshift(gapMessage)
      }
      return { success: false, hasMore: false }
    }
  }

  /**
   * 移除指定会话的所有 Gap 消息
   */
  function removeGapMessages(talker: string) {
    messages.value = messages.value.filter(msg => !(msg.isGap && msg.talker === talker))
  }

  /**
   * 移除指定的 Gap 消息
   */
  function removeGapMessage(gapId: number) {
    messages.value = messages.value.filter(msg => msg.id !== gapId)
  }

  /**
   * 检查会话是否存在 Gap 消息
   */
  function hasGapMessage(talker: string): boolean {
    return messages.value.some(msg => msg.isGap && msg.talker === talker)
  }

  async function refreshMessages() {
    if (!currentTalker.value) return
    await loadMessages(currentTalker.value, 1, false)
  }

  /**
   * 切换会话
   */
  async function switchSession(talker: string) {
    if (talker === currentTalker.value) return

    // 清空当前消息
    messages.value = []
    currentPage.value = 1
    hasMore.value = true
    clearSelection()

    // 加载新会话的消息
    await loadMessages(talker, 1, false)
  }

  /**
   * 搜索消息
   */
  async function searchMessages(keyword: string, params?: Partial<SearchParams>) {
    try {
      searchLoading.value = true
      searchKeyword.value = keyword
      appStore.setLoading('search', true)

      const searchParams: SearchParams = {
        keyword,
        talker: currentTalker.value || undefined,
        limit: params?.limit || 100,
        offset: params?.offset || 0,
        ...params,
      }

      const result = await chatlogAPI.searchMessages(searchParams)
      searchResults.value = result || []

      if (appStore.isDebug) {
        console.log('🔍 Search completed', {
          keyword,
          count: searchResults.value.length,
        })
      }

      return searchResults.value
    } catch (err) {
      error.value = err as Error
      appStore.setError(err as Error)
      throw err
    } finally {
      searchLoading.value = false
      appStore.setLoading('search', false)
    }
  }

  /**
   * 清除搜索
   */
  function clearSearch() {
    searchKeyword.value = ''
    searchResults.value = []
  }

  /**
   * 获取指定 ID 的消息
   */
  function getMessageById(id: number): Message | undefined {
    return messages.value.find(msg => msg.id === id)
  }

  /**
   * 获取消息索引
   */
  function getMessageIndex(id: number): number {
    return currentMessages.value.findIndex(msg => msg.id === id)
  }

  /**
   * 跳转到指定消息
   */
  async function jumpToMessage(messageId: number) {
    const message = getMessageById(messageId)
    if (!message) {
      // 如果消息不在当前列表中，需要加载包含该消息的页面
      // TODO: 实现按消息 ID 定位并加载
      console.warn('Message not found in current list:', messageId)
      return
    }

    // 滚动到消息位置
    const element = document.getElementById(`message-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 高亮显示
      element.classList.add('highlight')
      setTimeout(() => {
        element.classList.remove('highlight')
      }, 2000)
    }
  }

  /**
   * 选择消息
   */
  function selectMessage(id: number) {
    selectedMessageIds.value.add(id)
  }

  /**
   * 取消选择消息
   */
  function deselectMessage(id: number) {
    selectedMessageIds.value.delete(id)
  }

  /**
   * 切换消息选择状态
   */
  function toggleMessageSelection(id: number) {
    if (selectedMessageIds.value.has(id)) {
      deselectMessage(id)
    } else {
      selectMessage(id)
    }
  }

  /**
   * 全选消息
   */
  function selectAllMessages() {
    currentMessages.value.forEach(msg => {
      selectedMessageIds.value.add(msg.id)
    })
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedMessageIds.value.clear()
  }

  /**
   * 获取选中的消息
   */
  function getSelectedMessages(): Message[] {
    return currentMessages.value.filter(msg => selectedMessageIds.value.has(msg.id))
  }

  /**
   * 删除选中的消息（本地）
   */
  function deleteSelectedMessages() {
    const selectedIds = Array.from(selectedMessageIds.value)
    messages.value = messages.value.filter(msg => !selectedIds.includes(msg.id))
    clearSelection()
  }

  /**
   * 导出选中的消息
   */
  async function exportSelectedMessages(format: 'json' | 'csv' | 'text' = 'json') {
    const selected = getSelectedMessages()
    if (selected.length === 0) return

    const ids = selected.map(msg => msg.id).join(',')

    // TODO: 根据格式导出消息
    console.log('Exporting messages:', format, ids)
  }

  /**
   * 设置正在播放的语音
   */
  function setPlayingVoice(id: number | null) {
    playingVoiceId.value = id
  }

  /**
   * 获取消息统计
   */
  function getMessageStats() {
    const stats = {
      total: currentMessages.value.length,
      text: 0,
      image: 0,
      voice: 0,
      video: 0,
      file: 0,
      other: 0,
    }

    currentMessages.value.forEach(msg => {
      switch (msg.type) {
        case 1:
          stats.text++
          break
        case 3:
          stats.image++
          break
        case 34:
          stats.voice++
          break
        case 43:
          stats.video++
          break
        case 49:
          stats.file++
          break
        default:
          stats.other++
      }
    })

    return stats
  }



  /**
   * 清除错误
   */
  function clearError() {
    error.value = null
  }

  /**
   * 重置状态
   */
  function $reset() {
    messages.value = []
    currentTalker.value = ''
    totalMessages.value = 0
    currentPage.value = 1
    hasMore.value = true
    searchKeyword.value = ''
    searchResults.value = []
    selectedMessageIds.value.clear()
    playingVoiceId.value = null
    loading.value = false
    searchLoading.value = false
    error.value = null
    loadingHistory.value = false
    historyLoadMessage.value = ''
  }

  // 清理函数：移除事件监听器
  function cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('chatlog-cache-updated', handleCacheUpdate as EventListener)
    }
  }

  // ==================== Return ====================

  return {
    // State
    messages,
    currentTalker,
    totalMessages,
    currentPage,
    pageSize,
    hasMore,
    searchKeyword,
    searchResults,
    selectedMessageIds,
    playingVoiceId,
    loading,
    searchLoading,
    error,
    loadingHistory,
    historyLoadMessage,

    // Cache & Refresh stores
    cacheStore,
    refreshStore,

    // Getters
    currentMessages,
    messagesByDate,
    hasSelectedMessages,
    selectedCount,
    hasSearchResults,
    mediaMessages,
    imageMessages,
    videoMessages,
    fileMessages,

    // Actions
    loadMessages,
    loadMoreMessages,
    loadHistoryMessages,
    loadGapMessages,
    removeGapMessages,
    removeGapMessage,
    hasGapMessage,
    refreshMessages,
    switchSession,
    searchMessages,
    clearSearch,
    getMessageById,
    getMessageIndex,
    jumpToMessage,
    selectMessage,
    deselectMessage,
    toggleMessageSelection,
    selectAllMessages,
    clearSelection,
    getSelectedMessages,
    deleteSelectedMessages,
    exportSelectedMessages,
    setPlayingVoice,
    getMessageStats,
    clearError,
    $reset,
    cleanup
  }
})
