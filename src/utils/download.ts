/**
 * 文件下载工具函数
 * 提供浏览器端文件下载功能
 */

/**
 * MIME 类型映射
 */
export const MIME_TYPES: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  html: 'text/html;charset=utf-8',
  pdf: 'application/pdf',
  zip: 'application/zip',
}

/**
 * 下载文件选项
 */
export interface DownloadOptions {
  /** MIME 类型，不传则根据文件扩展名自动判断 */
  mimeType?: string
  /** 编码，默认为 utf-8 */
  encoding?: string
}

/**
 * 下载文件
 * @param content 文件内容（Blob 或字符串）
 * @param filename 文件名
 * @param options 下载选项
 */
export function downloadFile(
  content: Blob | string,
  filename: string,
  options: DownloadOptions = {}
): void {
  const { mimeType, encoding = 'utf-8' } = options

  // 确定 MIME 类型
  let finalMimeType = mimeType
  if (!finalMimeType && typeof content === 'string') {
    const ext = filename.split('.').pop()?.toLowerCase()
    finalMimeType = ext ? MIME_TYPES[ext] : 'text/plain'
  }
  // 创建 Blob
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: finalMimeType || `text/plain;charset=${encoding}` })

  // 创建 Blob URL
  const url = URL.createObjectURL(blob)

  // 创建临时链接并触发下载
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  // 添加到 DOM 并点击
  document.body.appendChild(link)
  link.click()

  // 清理
  document.body.removeChild(link)

  // 延迟清理 URL，确保下载已经开始
  setTimeout(() => {
    revokeDownloadUrl(url)
  }, 100)
}

/**
 * 释放 Blob URL
 * @param url 要释放的 Blob URL
 */
export function revokeDownloadUrl(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * 下载 JSON 数据
 * @param data 要下载的数据对象
 * @param filename 文件名（不含扩展名）
 */
export function downloadJSON(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`
  downloadFile(jsonStr, fullFilename, { mimeType: MIME_TYPES.json })
}

/**
 * 下载文本内容
 * @param content 文本内容
 * @param filename 文件名（不含扩展名）
 */
export function downloadText(content: string, filename: string): void {
  const fullFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`
  downloadFile(content, fullFilename, { mimeType: MIME_TYPES.txt })
}

/**
 * 下载 Markdown 内容
 * @param content Markdown 内容
 * @param filename 文件名（不含扩展名）
 */
export function downloadMarkdown(content: string, filename: string): void {
  const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`
  downloadFile(content, fullFilename, { mimeType: MIME_TYPES.md })
}

/**
 * 下载 CSV 内容
 * @param content CSV 内容
 * @param filename 文件名（不含扩展名）
 */
export function downloadCSV(content: string, filename: string): void {
  // 添加 BOM 以支持 Excel 中文显示
  const bom = '\uFEFF'
  const fullFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  downloadFile(bom + content, fullFilename, { mimeType: MIME_TYPES.csv })
}

/**
 * 从 URL 下载文件
 * @param url 文件 URL
 * @param filename 文件名
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    downloadFile(blob, filename)
  } catch (error) {
    console.error('下载文件失败:', error)
    throw error
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串（如 "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}
