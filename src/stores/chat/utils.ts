import type { Message } from '@/types/message'
import { createEmptyRangeMessage, parseTimeRangeStart } from '@/types/message'
import { toCST, formatCSTRange, subtractDays } from '@/utils/timezone'
import { chatlogAPI } from '@/api'

/**
 * 获取消息列表中最新消息的东八区时间
 */
export function getLatestMessageTime(messages: Message[]): string | undefined {
  if (!messages || messages.length === 0) return undefined
  const latest = messages[messages.length - 1]
  return latest.time
}

/**
 * 获取消息列表中最老消息的东八区时间
 */
export function getFirstMessageTime(messages: Message[]): string | undefined {
  if (!messages || messages.length === 0) return undefined
  const newest = messages[0]
  return newest.time
}

/**
 * 计算消息密度（条/天）
 * 基于已加载的消息分析时间分布
 */
export function calculateMessageDensity(messages: Message[], talker: string): number {
  const msgs = messages.filter(m => m.talker === talker)
  if (msgs.length < 2) return 0 // 无法计算密度

  const oldest = msgs[0]
  const newest = msgs[msgs.length - 1]
  const oldestTime = oldest.time ? new Date(oldest.time).getTime() : oldest.createTime * 1000
  const newestTime = newest.time ? new Date(newest.time).getTime() : newest.createTime * 1000

  const timeSpanDays = (newestTime - oldestTime) / (1000 * 60 * 60 * 24)
  if (timeSpanDays < 0.01) return msgs.length * 100 // 消息集中在很短时间内，认为超高密度

  const density = msgs.length / timeSpanDays
  return density
}

/**
 * 根据消息密度和 pageSize 确定初始时间范围（天数）
 */
export function getInitialDaysRange(messages: Message[], talker: string, limit: number, isDebug = false): number {
  const density = calculateMessageDensity(messages, talker)

  if (density <= 0) {
    return Math.max(Math.ceil(limit / 5), 7) // 至少 7 天
  }

  let daysRange = Math.ceil(limit / density)
  const minDays = 0.5   // 最少半天
  const maxDays = 90  // 最多 90 天
  daysRange = Math.max(minDays, Math.min(maxDays, daysRange))

  if (isDebug) {
    console.log('📐 Calculate days range:', {
      density: density.toFixed(2),
      pageSize: limit,
      calculatedDays: Math.ceil(limit / density),
      finalDays: daysRange,
      estimatedMessages: Math.round(daysRange * density)
    })
  }

  return daysRange
}

/**
 * 消息去重
 */
export function deduplicateMessages(messages: Message[], newMessages: Message[], isDebug = false): Message[] {
  const existingMessagesMap = new Map<string, Message>()
  messages.forEach(msg => {
    const key = `${msg.seq}_${msg.time}_${msg.talker}`
    existingMessagesMap.set(key, msg)
  })

  const uniqueNewMessages = newMessages.filter(newMsg => {
    const key = `${newMsg.seq}_${newMsg.time}_${newMsg.talker}`
    if (existingMessagesMap.has(key)) {
      const existingMsg = existingMessagesMap.get(key)!
      return !(
        existingMsg.sender === newMsg.sender &&
        existingMsg.type === newMsg.type &&
        existingMsg.content === newMsg.content &&
        JSON.stringify(existingMsg.contents) === JSON.stringify(newMsg.contents)
      )
    }
    return true
  })

  if (isDebug && uniqueNewMessages.length < newMessages.length) {
    console.log('🔍 Duplicate messages removed:', {
      total: newMessages.length,
      unique: uniqueNewMessages.length,
      duplicates: newMessages.length - uniqueNewMessages.length
    })
  }

  return uniqueNewMessages
}

/**
 * 根据消息密度估算时间范围内的消息数量
 * @param messages 已有消息列表
 * @param talker 会话 ID
 * @param startTime 起始时间（毫秒时间戳）
 * @param endTime 结束时间（毫秒时间戳）
 * @returns 预估的消息数量
 */
export function estimateMessageCount(
  messages: Message[],
  talker: string,
  startTime: number,
  endTime: number
): number {
  const density = calculateMessageDensity(messages, talker)
  
  if (density <= 0) {
    return 0
  }
  
  const timeSpanDays = (endTime - startTime) / (1000 * 60 * 60 * 24)
  const estimatedCount = Math.round(density * timeSpanDays)
  
  return Math.max(0, estimatedCount)
}

/**
 * 检查新加载的数据是否与已有数据衔接
 * @param newMessages 新加载的消息（原始数据，未去重）
 * @param existingMessages 已有的消息列表
 * @returns 是否衔接
 */
export function checkDataConnection(newMessages: Message[], existingMessages: Message[]): boolean {
  if (newMessages.length === 0) return false
  
  // 找到第一条非虚拟消息作为已有数据的最早消息
  const existingFirstRealMsg = existingMessages.find(msg => !msg.isGap && !msg.isEmptyRange)
  if (!existingFirstRealMsg) return false
  
  // 使用原始数据的最后一条消息
  const newestLoadedMsg = newMessages[newMessages.length - 1]
  
  // 方式1：比较 seq 和 time 判断是否是同一条消息
  if (newestLoadedMsg.seq === existingFirstRealMsg.seq && 
      newestLoadedMsg.time === existingFirstRealMsg.time) {
    return true
  }
  
  // 方式2：检查时间是否紧密相连（时间差小于等于 1 秒）
  const newestLoadedTime = newestLoadedMsg.time 
    ? new Date(newestLoadedMsg.time).getTime() 
    : newestLoadedMsg.createTime * 1000
  const existingFirstTime = existingFirstRealMsg.time 
    ? new Date(existingFirstRealMsg.time).getTime() 
    : existingFirstRealMsg.createTime * 1000
  
  const timeDiff = Math.abs(existingFirstTime - newestLoadedTime)
  return timeDiff <= 1000
}

/**
 * 检测时间间隙
 */
export function detectTimeGap(
  talker: string,
  timeRange: string,
  offset: number,
  newMessages: Message[],
  isDebug = false
): Message | null {
  if (offset === 0 && timeRange && newMessages.length > 0) {
    const requestedStartTime = parseTimeRangeStart(timeRange)
    const oldestReturnedMsg = newMessages[0]
    const oldestMsgTime = oldestReturnedMsg.time
      ? new Date(oldestReturnedMsg.time).getTime()
      : oldestReturnedMsg.createTime * 1000

    const timeDiffSeconds = (oldestMsgTime - requestedStartTime) / 1000
    const gapThresholdSeconds = 600 // 600秒

    if (timeDiffSeconds > gapThresholdSeconds) {
      const gapStartDate = new Date(requestedStartTime)
      const gapEndDate = new Date(oldestMsgTime)
      const gapTimeRange = formatCSTRange(gapStartDate, gapEndDate)

      const newestMsgTime = oldestReturnedMsg.time
      const emptyRangeMessage = createEmptyRangeMessage(
        talker,
        gapTimeRange,
        newestMsgTime,
        0,
        requestedStartTime
      )

      if (isDebug) {
        console.log('📝 EmptyRange detected for time gap:', {
          talker,
          requestedStartTime: new Date(requestedStartTime).toISOString(),
          oldestMsgTime: new Date(oldestMsgTime).toISOString(),
          gapDays: (timeDiffSeconds / 86400).toFixed(1),
          gapTimeRange,
          suggestedBeforeTime: new Date(requestedStartTime).toISOString()
        })
      }

      return emptyRangeMessage
    }
  }
  return null
}

/**
 * 在指定时间范围内加载消息
 */
export async function loadMessagesInTimeRange(
  talker: string,
  timeRange: string,
  limit: number,
  offset: number
): Promise<Message[]> {
  return await chatlogAPI.getSessionMessages(talker, timeRange, limit, offset, 1)
}

/**
 * 智能获取历史消息（包含重试逻辑）
 */
export async function fetchSmartHistoryMessages(
  messages: Message[],
  talker: string,
  beforeTime: string | number,
  limit: number,
  offset: number,
  isDebug = false
): Promise<{ result: Message[], finalTimeRange: string, retryCount: number, daysRange: number }> {
  const beforeDate = typeof beforeTime === 'string'
    ? new Date(beforeTime)
    : new Date(beforeTime * 1000)

  const density = calculateMessageDensity(messages, talker)
  let daysRange = getInitialDaysRange(messages, talker, limit, isDebug)

  if (isDebug) {
    console.log('🔍 Load new time range:', {
      density: density.toFixed(2),
      initialDaysRange: daysRange,
      beforeTime,
      beforeDate: toCST(beforeDate),
      offset
    })
  }

  let result: Message[] = []
  let finalTimeRange = ''
  let retryCount = 0
  const maxRetries = 3

  while (result.length === 0 && retryCount < maxRetries) {
    const startDate = subtractDays(beforeDate, daysRange)
    const timeRange = formatCSTRange(startDate, beforeDate)
    finalTimeRange = timeRange

    if (isDebug) {
      console.log(`🔄 Loading history attempt ${retryCount + 1}/${maxRetries}:`, {
        timeRange,
        daysRange,
        density: density.toFixed(2),
        offset,
        limit
      })
    }

    result = await loadMessagesInTimeRange(talker, timeRange, limit, offset)

    if (result.length === 0) {
      daysRange *= 2
      retryCount++
    }
  }

  return { result, finalTimeRange, retryCount, daysRange }
}

/**
 * 处理空结果情况
 */
export function handleEmptyResult(
  messages: Message[],
  talker: string,
  timeRange: string,
  offset: number,
  retryCount: number,
  isDebug = false
): { messages: Message[], hasMore: boolean, timeRange: string, offset: number, newMessages: Message[] } {
  if (offset === 0) {
    const suggestedBeforeTime = parseTimeRangeStart(timeRange)
    const newestMsgTime = getFirstMessageTime(messages.filter(m => m.talker === talker))
    const emptyRangeMessage = createEmptyRangeMessage(
      talker,
      timeRange,
      newestMsgTime,
      retryCount,
      suggestedBeforeTime
    )

    if (isDebug) {
      console.log('📝 EmptyRange message created for empty history:', {
        talker,
        timeRange,
        triedTimes: retryCount,
        suggestedBeforeTime: new Date(suggestedBeforeTime).toISOString()
      })
    }

    const newMessages = [emptyRangeMessage, ...messages]

    return {
      messages: newMessages,
      hasMore: true,
      timeRange,
      offset: 0,
      newMessages: [emptyRangeMessage]
    }
  } else {
    if (isDebug) {
      console.log('✅ Current time range completed, no more messages at offset:', offset)
    }
    return { messages, hasMore: false, timeRange, offset, newMessages: [] }
  }
}