<!--
  AI 消息气泡组件
  用于展示 AI 对话中的用户和助手消息
-->
<template>
  <div 
    :class="[
      'ai-message-bubble',
      `bubble-${message.role}`,
      `status-${message.status}`
    ]"
  >
    <!-- 消息头部 -->
    <div class="bubble-header">
      <div class="bubble-avatar">
        <el-icon v-if="message.role === 'user'" :size="20">
          <User />
        </el-icon>
        <el-icon v-else :size="20">
          <ChatDotRound />
        </el-icon>
      </div>
      
      <div class="bubble-meta">
        <span class="bubble-role">
          {{ message.role === 'user' ? '用户' : 'AI 助手' }}
        </span>
        <span class="bubble-time">
          {{ formatTime(message.timestamp) }}
        </span>
      </div>

      <!-- 操作按钮 -->
      <div v-if="showActions" class="bubble-actions">
        <el-tooltip content="复制" placement="top">
          <el-button 
            text 
            circle 
            size="small"
            @click="handleCopy"
          >
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="message.role === 'assistant'" content="重新生成" placement="top">
          <el-button 
            text 
            circle 
            size="small"
            :disabled="isProcessing"
            @click="handleRetry"
          >
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip content="删除" placement="top">
          <el-button 
            text 
            circle 
            size="small"
            :disabled="isProcessing"
            @click="handleDelete"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 上下文标签 -->
    <div v-if="message.context && showContext" class="bubble-context">
      <el-tag size="small" type="info">
        <el-icon><CollectionTag /></el-icon>
        包含上下文
      </el-tag>
      
      <span v-if="message.context.tokenCount" class="context-tokens">
        {{ message.context.tokenCount }} tokens
      </span>

      <el-button 
        text 
        size="small"
        @click="showContextPreview = true"
      >
        查看详情
      </el-button>
    </div>

    <!-- 消息内容 -->
    <div class="bubble-content">
      <!-- 流式输出中 -->
      <div v-if="message.status === 'streaming'" class="streaming-content">
        <div class="markdown-body" v-html="renderMarkdown(displayContent)"></div>
        <StreamingIndicator />
      </div>

      <!-- 正常内容 -->
      <div v-else-if="message.status === 'success'" class="markdown-body" v-html="renderMarkdown(message.content)"></div>

      <!-- 发送中 -->
      <div v-else-if="message.status === 'sending'" class="sending-content">
        <el-icon class="is-loading"><Loading /></el-icon>
        发送中...
      </div>

      <!-- 错误状态 -->
      <div v-else-if="message.status === 'error'" class="error-content">
        <el-alert
          type="error"
          :title="message.error || '发送失败'"
          :closable="false"
        >
          <template #default>
            <el-button size="small" @click="handleRetry">
              重试
            </el-button>
          </template>
        </el-alert>
      </div>
    </div>

    <!-- Token 使用信息 -->
    <div v-if="message.tokenUsage && showTokenUsage" class="bubble-usage">
      <el-space :size="12">
        <span class="usage-item">
          <el-icon><Promotion /></el-icon>
          输入: {{ message.tokenUsage.input.toLocaleString() }}
        </span>
        <span class="usage-item">
          <el-icon><Download /></el-icon>
          输出: {{ message.tokenUsage.output.toLocaleString() }}
        </span>
        <span class="usage-item usage-cost">
          <el-icon><Money /></el-icon>
          成本: ${{ message.tokenUsage.cost.toFixed(4) }}
        </span>
      </el-space>
    </div>

    <!-- 上下文预览对话框 -->
    <el-dialog
      v-model="showContextPreview"
      title="上下文详情"
      width="600px"
    >
      <div v-if="message.context" class="context-preview">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item v-if="message.context.sessions?.length" label="引用会话">
            {{ message.context.sessions.length }} 个会话
          </el-descriptions-item>
          <el-descriptions-item v-if="message.context.messages?.length" label="引用消息">
            {{ message.context.messages.length }} 条消息
          </el-descriptions-item>
          <el-descriptions-item v-if="message.context.users?.length" label="引用用户">
            {{ message.context.users.length }} 个用户
          </el-descriptions-item>
          <el-descriptions-item v-if="message.context.timeRange" label="时间范围">
            {{ formatDate(message.context.timeRange.start) }} - {{ formatDate(message.context.timeRange.end) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="message.context.tokenCount" label="Token 数量">
            {{ message.context.tokenCount.toLocaleString() }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="message.context.preview" class="context-preview-content">
          <h4>上下文预览</h4>
          <pre>{{ message.context.preview }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  User, 
  ChatDotRound, 
  DocumentCopy, 
  RefreshRight, 
  Delete,
  CollectionTag,
  Loading,
  Promotion,
  Download,
  Money
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { MessageRecord } from '@/types/ai'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import StreamingIndicator from './StreamingIndicator.vue'

// ==================== Props & Emits ====================

interface Props {
  /** 消息对象 */
  message: MessageRecord
  /** 是否显示操作按钮 */
  showActions?: boolean
  /** 是否显示上下文信息 */
  showContext?: boolean
  /** 是否显示 Token 使用信息 */
  showTokenUsage?: boolean
  /** 是否正在处理中 */
  isProcessing?: boolean
  /** 流式输出的临时内容（用于覆盖 message.content） */
  streamingContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  showContext: true,
  showTokenUsage: true,
  isProcessing: false,
  streamingContent: ''
})

interface Emits {
  (e: 'copy', content: string): void
  (e: 'retry'): void
  (e: 'delete'): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const showContextPreview = ref(false)

// ==================== Computed ====================

/**
 * 显示的内容（流式输出时使用 streamingContent）
 */
const displayContent = computed(() => {
  if (props.message.status === 'streaming' && props.streamingContent) {
    return props.streamingContent
  }
  return props.message.content
})

// ==================== Methods ====================

/**
 * 格式化时间
 */
function formatTime(timestamp: Date): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于 1 分钟
  if (diff < 60 * 1000) {
    return '刚刚'
  }

  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes} 分钟前`
  }

  // 小于 24 小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours} 小时前`
  }

  // 今年内
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 完整日期
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 渲染 Markdown
 */
function renderMarkdown(content: string): string {
  if (!content) return ''
  
  try {
    // 配置 marked
    marked.setOptions({
      breaks: true,
      gfm: true
    })

    const html = marked.parse(content) as string
    // 使用 DOMPurify 清理 HTML，防止 XSS
    return DOMPurify.sanitize(html)
  } catch (err) {
    console.error('Markdown 渲染失败:', err)
    // 降级为纯文本
    return content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  }
}

/**
 * 复制消息内容
 */
async function handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制到剪贴板')
    emit('copy', props.message.content)
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败')
  }
}

/**
 * 重试消息
 */
function handleRetry(): void {
  emit('retry')
}

/**
 * 删除消息
 */
async function handleDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条消息吗？',
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    emit('delete')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.ai-message-bubble {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: all 0.3s;

  &:hover {
    background: var(--el-fill-color-light);
    
    .bubble-actions {
      opacity: 1;
    }
  }

  // 用户消息
  &.bubble-user {
    border-left: 3px solid var(--el-color-primary);
  }

  // AI 消息
  &.bubble-assistant {
    border-left: 3px solid var(--el-color-success);
  }

  // 错误状态
  &.status-error {
    border-left-color: var(--el-color-danger);
  }

  // 流式输出状态
  &.status-streaming {
    border-left-color: var(--el-color-warning);
  }
}

.bubble-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.bubble-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  flex-shrink: 0;

  .bubble-user & {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  .bubble-assistant & {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }
}

.bubble-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bubble-role {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.bubble-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.bubble-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.bubble-context {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  font-size: 12px;
}

.context-tokens {
  color: var(--el-text-color-secondary);
}

.bubble-content {
  padding-left: 44px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

.streaming-content {
  .markdown-body {
    margin-bottom: 8px;
  }
}

.sending-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.error-content {
  :deep(.el-alert) {
    background: transparent;
    border: none;
    padding: 0;
  }
}

.bubble-usage {
  margin-top: 12px;
  padding-top: 12px;
  padding-left: 44px;
  border-top: 1px dashed var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.usage-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .el-icon {
    font-size: 14px;
  }
}

.usage-cost {
  color: var(--el-color-primary);
  font-weight: 500;
}

.context-preview-content {
  margin-top: 16px;

  h4 {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  pre {
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.6;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
}

// Markdown 样式
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;

  p {
    margin: 0 0 12px 0;

    &:last-child {
      margin-bottom: 0;
    }
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 16px 0 12px 0;
    font-weight: 600;
    line-height: 1.4;

    &:first-child {
      margin-top: 0;
    }
  }

  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 18px; }
  h4 { font-size: 16px; }
  h5 { font-size: 14px; }
  h6 { font-size: 14px; color: var(--el-text-color-secondary); }

  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 24px;
  }

  li {
    margin: 4px 0;
  }

  code {
    padding: 2px 6px;
    background: var(--el-fill-color-light);
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
  }

  pre {
    margin: 12px 0;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    overflow-x: auto;

    code {
      padding: 0;
      background: transparent;
    }
  }

  blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid var(--el-border-color);
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-secondary);

    p {
      margin: 0;
    }
  }

  table {
    width: 100%;
    margin: 12px 0;
    border-collapse: collapse;

    th, td {
      padding: 8px 12px;
      border: 1px solid var(--el-border-color);
      text-align: left;
    }

    th {
      background: var(--el-fill-color-light);
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: var(--el-fill-color-lighter);
    }
  }

  a {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  hr {
    margin: 16px 0;
    border: none;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 8px 0;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .ai-message-bubble {
    padding: 12px;
  }

  .bubble-content {
    padding-left: 0;
  }

  .bubble-usage {
    padding-left: 0;
  }

  .bubble-actions {
    opacity: 1; // 移动端始终显示
  }
}
</style>