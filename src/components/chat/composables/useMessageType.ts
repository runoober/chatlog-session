import { computed } from 'vue'
import type { Message } from '@/types'
import { MessageType, RichMessageSubType } from '@/types/message'
import { findMessageTypeConfig } from '../message-types/config'

/**
 * 基于配置的消息类型判断 composable
 * 替代原有的 useMessageContent
 */
export function useMessageType(message: Message) {
  // 查找当前消息的配置
  const messageConfig = computed(() => 
    findMessageTypeConfig(message.type, message.subType)
  )

  // 获取组件名称
  const componentName = computed(() => messageConfig.value?.component)

  // ==================== 基础消息类型判断 ====================
  const isTextMessage = computed(() => message.type === MessageType.Text)
  const isImageMessage = computed(() => message.type === MessageType.Image)
  const isVoiceMessage = computed(() => message.type === MessageType.Voice)
  const isContactCardMessage = computed(() => message.type === MessageType.ContactCard)
  const isVideoMessage = computed(() => message.type === MessageType.Video)
  const isEmojiMessage = computed(() => message.type === MessageType.Emoji)
  const isLocationMessage = computed(() => message.type === MessageType.Location)
  const isSystemMessage = computed(() => message.type === MessageType.System)
  const isRevokeMessage = computed(() => message.type === MessageType.Revoke)
  const isGapMessage = computed(() => message.type === MessageType.Gap || message.isGap)
  const isEmptyRangeMessage = computed(() => message.type === MessageType.EmptyRange || message.isEmptyRange)
  const isQQMailMessage = computed(() => message.type === MessageType.QQMail)
  const isVoiceCallMessage = computed(() => message.type === MessageType.VoiceCall)

  // ==================== 富文本消息子类型判断 ====================
  const isQQMusicMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.QQMusic
  )
  const isVideoLinkMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.VideoLink
  )
  const isEmojiNotDownloadedMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.EmojiNotDownloaded
  )
  const isCardPackageMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.CardPackage
  )
  const isReferMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Refer
  )
  const isLinkMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Link
  )
  const isForwardedMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Forwarded
  )
  const isFileMessage = computed(
    () =>
      message.type === MessageType.File &&
      (message.subType === RichMessageSubType.File ||
        message.subType === RichMessageSubType.FileDownloading)
  )
  const isMiniProgramMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.MiniProgram
  )
  const isShoppingMiniProgramMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.ShoppingMiniProgram
  )
  const isShortVideoMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.ShortVideo
  )
  const isPatMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Pat
  )
  const isLiveMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Live
  )
  const isJielongMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Jielong
  )
  const isTransferMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.Transfer
  )
  const isRedPacketMessage = computed(
    () => message.type === MessageType.File && message.subType === RichMessageSubType.RedPacket
  )

  // 其他富文本消息（未在配置中定义的）
  const isOtherRichMessage = computed(() => {
    if (message.type !== MessageType.File) return false
    
    // 如果找不到配置，说明是未知的富文本消息类型
    return !messageConfig.value
  })

  // ==================== 引用消息相关 ====================
  const referMessage = computed(() => {
    return message.contents?.refer
  })

  // 判断引用消息的类型
  const referMessageType = computed(() => {
    if (!referMessage.value) return null
    const refer = referMessage.value
    if (refer.type === MessageType.Image) return 'image'
    if (refer.type === MessageType.File && refer.subType === RichMessageSubType.Link)
      return 'link'
    return 'text'
  })

  // ==================== 其他属性 ====================
  const isSelf = computed(() => message.isSelf)

  // 是否需要特殊渲染（系统消息、虚拟消息等）
  const isSpecialMessage = computed(
    () => isSystemMessage.value || 
          isRevokeMessage.value || 
          isGapMessage.value || 
          isEmptyRangeMessage.value ||
          isPatMessage.value
  )

  // 是否是普通消息（有气泡的消息）
  const isNormalMessage = computed(() => !isSpecialMessage.value)

  return {
    // 配置相关
    messageConfig,
    componentName,
    
    // 基础类型判断
    isTextMessage,
    isImageMessage,
    isVoiceMessage,
    isContactCardMessage,
    isVideoMessage,
    isEmojiMessage,
    isLocationMessage,
    isSystemMessage,
    isRevokeMessage,
    isGapMessage,
    isEmptyRangeMessage,
    isQQMailMessage,
    isVoiceCallMessage,
    
    // 富文本子类型判断
    isQQMusicMessage,
    isVideoLinkMessage,
    isCardPackageMessage,
    isReferMessage,
    isLinkMessage,
    isForwardedMessage,
    isFileMessage,
    isMiniProgramMessage,
    isShoppingMiniProgramMessage,
    isShortVideoMessage,
    isPatMessage,
    isLiveMessage,
    isJielongMessage,
    isTransferMessage,
    isRedPacketMessage,
    isEmojiNotDownloadedMessage,
    isOtherRichMessage,
    
    // 引用消息相关
    referMessage,
    referMessageType,
    
    // 其他属性
    isSelf,
    isSpecialMessage,
    isNormalMessage,
  }
}