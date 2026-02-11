import { FileSizeBase, FileSizeUnits } from '@/types/message'
import { getMessagePlaceholder as getPlaceholderFromConfig } from '../message-types/config'

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(FileSizeBase))
  return Math.round((bytes / Math.pow(FileSizeBase, i)) * 100) / 100 + ' ' + FileSizeUnits[i]
}

/**
 * 获取媒体消息的文本描述
 * 现在使用集中配置
 */
export function getMediaPlaceholder(type: number, subType?: number, fileName?: string): string {

  return getPlaceholderFromConfig(type, subType, fileName)
}

