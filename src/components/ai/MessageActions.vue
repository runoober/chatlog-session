<!--
  消息操作菜单组件
  用于展示和处理 AI 消息的操作（复制、重试、删除等）
-->
<template>
  <div class="message-actions">
    <el-dropdown
      trigger="click"
      placement="bottom-end"
      @command="handleCommand"
    >
      <el-button 
        :size="size" 
        :circle="circle"
        :text="text"
      >
        <el-icon><MoreFilled /></el-icon>
      </el-button>
      
      <template #dropdown>
        <el-dropdown-menu>
          <!-- 复制 -->
          <el-dropdown-item 
            command="copy"
            :icon="DocumentCopy"
          >
            复制内容
          </el-dropdown-item>

          <!-- 复制为 Markdown -->
          <el-dropdown-item 
            v-if="showCopyMarkdown"
            command="copy-markdown"
            :icon="Document"
          >
            复制为 Markdown
          </el-dropdown-item>

          <!-- 重新生成（仅 AI 消息） -->
          <el-dropdown-item 
            v-if="role === 'assistant'"
            command="retry"
            :icon="RefreshRight"
            :disabled="disabled"
            divided
          >
            重新生成
          </el-dropdown-item>

          <!-- 编辑（仅用户消息） -->
          <el-dropdown-item 
            v-if="role === 'user' && showEdit"
            command="edit"
            :icon="Edit"
            :disabled="disabled"
          >
            编辑消息
          </el-dropdown-item>

          <!-- 引用 -->
          <el-dropdown-item 
            v-if="showReference"
            command="reference"
            :icon="Link"
            divided
          >
            引用到新对话
          </el-dropdown-item>

          <!-- 分享 -->
          <el-dropdown-item 
            v-if="showShare"
            command="share"
            :icon="Share"
          >
            分享消息
          </el-dropdown-item>

          <!-- 导出 -->
          <el-dropdown-item 
            v-if="showExport"
            command="export"
            :icon="Download"
          >
            导出消息
          </el-dropdown-item>

          <!-- 删除 -->
          <el-dropdown-item 
            command="delete"
            :icon="Delete"
            :disabled="disabled"
            divided
          >
            <span style="color: var(--el-color-danger)">删除消息</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import {
  MoreFilled,
  DocumentCopy,
  Document,
  RefreshRight,
  Edit,
  Link,
  Share,
  Download,
  Delete
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AIMessageRole } from '@/types/ai'

// ==================== Props & Emits ====================

interface Props {
  /** 消息角色 */
  role: AIMessageRole
  /** 消息内容 */
  content: string
  /** 消息 ID */
  messageId?: number
  /** 按钮尺寸 */
  size?: 'large' | 'default' | 'small'
  /** 是否圆形按钮 */
  circle?: boolean
  /** 是否文本按钮 */
  text?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示复制为 Markdown */
  showCopyMarkdown?: boolean
  /** 是否显示编辑 */
  showEdit?: boolean
  /** 是否显示引用 */
  showReference?: boolean
  /** 是否显示分享 */
  showShare?: boolean
  /** 是否显示导出 */
  showExport?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  circle: true,
  text: true,
  disabled: false,
  showCopyMarkdown: true,
  showEdit: true,
  showReference: true,
  showShare: false,
  showExport: true
})

interface Emits {
  (e: 'copy', content: string): void
  (e: 'copy-markdown', content: string): void
  (e: 'retry'): void
  (e: 'edit'): void
  (e: 'reference'): void
  (e: 'share'): void
  (e: 'export'): void
  (e: 'delete'): void
}

const emit = defineEmits<Emits>()

// ==================== Methods ====================

/**
 * 处理命令
 */
async function handleCommand(command: string): Promise<void> {
  switch (command) {
    case 'copy':
      await handleCopy()
      break
    case 'copy-markdown':
      await handleCopyMarkdown()
      break
    case 'retry':
      handleRetry()
      break
    case 'edit':
      handleEdit()
      break
    case 'reference':
      handleReference()
      break
    case 'share':
      handleShare()
      break
    case 'export':
      handleExport()
      break
    case 'delete':
      await handleDelete()
      break
  }
}

/**
 * 复制内容
 */
async function handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.content)
    ElMessage.success('已复制到剪贴板')
    emit('copy', props.content)
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败')
  }
}

/**
 * 复制为 Markdown
 */
async function handleCopyMarkdown(): Promise<void> {
  try {
    const markdown = `### ${props.role === 'user' ? '用户' : 'AI 助手'}\n\n${props.content}`
    await navigator.clipboard.writeText(markdown)
    ElMessage.success('已复制为 Markdown 格式')
    emit('copy-markdown', markdown)
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败')
  }
}

/**
 * 重新生成
 */
function handleRetry(): void {
  emit('retry')
}

/**
 * 编辑消息
 */
function handleEdit(): void {
  emit('edit')
}

/**
 * 引用到新对话
 */
function handleReference(): void {
  emit('reference')
}

/**
 * 分享消息
 */
function handleShare(): void {
  emit('share')
}

/**
 * 导出消息
 */
function handleExport(): void {
  emit('export')
}

/**
 * 删除消息
 */
async function handleDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条消息吗？此操作无法撤销。',
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
    emit('delete')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.message-actions {
  display: inline-flex;
}

:deep(.el-dropdown-menu__item) {
  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>