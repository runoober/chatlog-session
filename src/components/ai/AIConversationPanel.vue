<!--
  AI 对话面板主组件
  整合消息列表、输入框、上下文管理等功能
-->
<template>
  <div class="ai-conversation-panel">
    <!-- 头部：对话信息和操作 -->
    <div class="panel-header">
      <div class="header-left">
        <h2 class="conversation-title">
          {{ currentConversation?.title || '新对话' }}
        </h2>
        <el-tag v-if="isProcessing" type="warning" size="small">
          <el-icon class="is-loading"><Loading /></el-icon>
          生成中...
        </el-tag>
      </div>

      <div class="header-right">
        <!-- Token 使用统计 -->
        <el-tooltip v-if="totalTokens > 0" placement="bottom">
          <template #content>
            <div class="token-tooltip">
              <div>总 Token: {{ totalTokens.toLocaleString() }}</div>
              <div v-if="totalCost > 0">总成本: ${{ totalCost.toFixed(4) }}</div>
            </div>
          </template>
          <el-tag type="info" size="small">
            <el-icon><Tickets /></el-icon>
            {{ formatNumber(totalTokens) }}
          </el-tag>
        </el-tooltip>

        <!-- 操作按钮 -->
        <el-button-group>
          <el-tooltip content="清空对话" placement="bottom">
            <el-button
              text
              :disabled="messageCount === 0 || isProcessing"
              @click="handleClearMessages"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip content="导出对话" placement="bottom">
            <el-button
              text
              :disabled="messageCount === 0"
              @click="handleExportConversation"
            >
              <el-icon><Download /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip content="对话设置" placement="bottom">
            <el-button text @click="showSettings = true">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </div>

    <!-- 上下文信息栏 -->
    <div v-if="currentContext" class="context-bar">
      <ContextTags
        :context="currentContext"
        :closable="!isProcessing"
        @remove-session="handleRemoveContextSession"
        @remove-user="handleRemoveContextUser"
        @remove-messages="handleRemoveContextMessages"
        @remove-time-range="handleRemoveContextTimeRange"
        @show-detail="showContextDetail = true"
      />
      
      <el-button
        text
        size="small"
        :disabled="isProcessing"
        @click="handleClearContext"
      >
        <el-icon><CircleClose /></el-icon>
        清除上下文
      </el-button>
    </div>

    <!-- 消息列表区域 -->
    <div ref="messagesContainer" class="messages-container">
      <!-- 空状态 -->
      <div v-if="messageCount === 0" class="empty-state">
        <el-empty description="还没有消息，开始对话吧">
          <div class="empty-actions">
            <el-button type="primary" @click="focusInput">
              <el-icon><ChatLineRound /></el-icon>
              开始对话
            </el-button>
            <el-button @click="showPromptSelector = true">
              <el-icon><Memo /></el-icon>
              使用提示词
            </el-button>
          </div>
        </el-empty>
      </div>

      <!-- 消息列表 -->
      <div v-else class="messages-list">
        <AIMessageBubble
          v-for="message in currentMessages"
          :key="message.id || message.timestamp.getTime()"
          :message="message"
          :show-actions="!isProcessing"
          :show-context="true"
          :show-token-usage="showTokenUsage"
          :is-processing="isProcessing"
          :streaming-content="message.status === 'streaming' ? streamingContent : ''"
          @copy="handleCopyMessage"
          @retry="handleRetryMessage(message)"
          @delete="handleDeleteMessage(message)"
        />

        <!-- 滚动到底部按钮 -->
        <transition name="fade">
          <el-button
            circle
            class="scroll-to-bottom"
            @click="() => scrollToBottom()"
          >
            <el-icon><ArrowDown /></el-icon>
          </el-button>
        </transition>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 工具栏 -->
      <div class="input-toolbar">
        <el-space :size="8">
          <!-- 提示词选择 -->
          <el-tooltip content="使用提示词模板" placement="top">
            <el-button
              text
              size="small"
              :disabled="isProcessing"
              @click="showPromptSelector = true"
            >
              <el-icon><Memo /></el-icon>
              提示词
            </el-button>
          </el-tooltip>

          <!-- 引用选择 -->
          <el-tooltip content="添加上下文引用" placement="top">
            <el-button
              text
              size="small"
              :disabled="isProcessing"
              @click="showReferenceSelector = true"
            >
              <el-icon><Link /></el-icon>
              添加引用
              <el-badge
                v-if="currentContext"
                :value="getContextItemCount(currentContext)"
                class="context-badge"
              />
            </el-button>
          </el-tooltip>

          <!-- 清空输入 -->
          <el-tooltip v-if="inputMessage.trim()" content="清空输入" placement="top">
            <el-button
              text
              size="small"
              :disabled="isProcessing"
              @click="inputMessage = ''"
            >
              <el-icon><CircleClose /></el-icon>
            </el-button>
          </el-tooltip>
        </el-space>

        <el-space :size="8">
          <!-- 字数统计 -->
          <span v-if="inputMessage.trim()" class="char-count">
            {{ inputMessage.length }} 字符
          </span>

          <!-- 快捷键提示 -->
          <span class="shortcut-hint">
            {{ isMac ? 'Cmd+Enter' : 'Ctrl+Enter' }} 发送
          </span>
        </el-space>
      </div>

      <!-- 输入框 -->
      <el-input
        ref="inputRef"
        v-model="inputMessage"
        type="textarea"
        :rows="inputRows"
        :placeholder="inputPlaceholder"
        :disabled="isProcessing"
        resize="none"
        maxlength="10000"
        show-word-limit
        @keydown="(e) => handleKeyDown(e as KeyboardEvent)"
      />

      <!-- 发送按钮 -->
      <div class="input-actions">
        <el-button
          type="primary"
          :loading="isProcessing"
          :disabled="!canSend"
          @click="handleSendMessage"
        >
          <el-icon v-if="!isProcessing"><Position /></el-icon>
          {{ isProcessing ? '生成中...' : '发送' }}
        </el-button>

        <el-button
          v-if="isProcessing"
          @click="handleStopGeneration"
        >
          <el-icon><VideoPause /></el-icon>
          停止生成
        </el-button>
      </div>
    </div>

    <!-- 提示词选择器对话框 -->
    <el-dialog
      v-model="showPromptSelector"
      title="选择提示词模板"
      width="800px"
      :close-on-click-modal="false"
    >
      <PromptSelector
        @select="handlePromptSelect"
        @cancel="showPromptSelector = false"
      />
    </el-dialog>

    <!-- 引用选择器对话框 -->
    <el-dialog
      v-model="showReferenceSelector"
      title="选择上下文引用"
      width="900px"
      :close-on-click-modal="false"
    >
      <ReferenceSelector
        @confirm="() => handleReferenceConfirm()"
        @cancel="showReferenceSelector = false"
      />
    </el-dialog>

    <!-- 上下文详情对话框 -->
    <el-dialog
      v-model="showContextDetail"
      title="上下文详情"
      width="700px"
    >
      <ContextPreview
        v-if="referenceStore.currentReferences.length > 0"
        :references="referenceStore.currentReferences"
        :strategy="referenceStore.buildStrategy"
        :max-tokens="referenceStore.maxTokens"
        @rebuild="handleRebuildContext"
        @copy="handleCopyContext"
      />
      <el-empty v-else description="暂无上下文引用" />
    </el-dialog>

    <!-- 设置对话框 -->
    <el-dialog
      v-model="showSettings"
      title="对话设置"
      width="600px"
    >
      <el-form label-width="120px">
        <el-form-item label="显示 Token">
          <el-switch v-model="showTokenUsage" />
        </el-form-item>
        <el-form-item label="自动滚动">
          <el-switch v-model="autoScroll" />
        </el-form-item>
        <el-form-item label="输入框行数">
          <el-slider
            v-model="inputRows"
            :min="2"
            :max="10"
            :step="1"
            show-stops
          />
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import {
  Loading,
  Tickets,
  Delete,
  Download,
  Setting,
  CircleClose,
  ChatLineRound,
  Memo,
  Link,
  ArrowDown,
  Position,
  VideoPause
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAIConversationStore } from '@/stores/ai/conversation'
import { useReferenceStore } from '@/stores/ai/reference'
// @ts-ignore
import { storeToRefs } from 'pinia'
import type { ContextInfo, Prompt, MessageRecord } from '@/types/ai'
import AIMessageBubble from './AIMessageBubble.vue'
import ContextTags from './ContextTags.vue'
import PromptSelector from './PromptSelector.vue'
import ReferenceSelector from './ReferenceSelector.vue'
import ContextPreview from './ContextPreview.vue'

// ==================== Props & Emits ====================

interface Props {
  /** 对话 ID */
  conversationId?: number | null
  /** 输入框占位符 */
  inputPlaceholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  conversationId: null,
  inputPlaceholder: '输入消息... (Ctrl+Enter 发送)'
})

interface Emits {
  (e: 'conversation-created', conversationId: number): void
  (e: 'message-sent'): void
}

const emit = defineEmits<Emits>()

// ==================== Store ====================

const conversationStore = useAIConversationStore()
const referenceStore = useReferenceStore()

const {
  currentConversation,
  currentMessages,
  isProcessing,
  streamingContent,
  currentContext,
  messageCount,
  totalTokens,
  totalCost
} = storeToRefs(conversationStore)

// ==================== State ====================

const inputMessage = ref('')
const inputRows = ref(3)
const showTokenUsage = ref(true)
const autoScroll = ref(true)
const showScrollButton = ref(false)
const showPromptSelector = ref(false)
const showReferenceSelector = ref(false)
const showContextDetail = ref(false)
const showSettings = ref(false)

const messagesContainer = ref<HTMLElement>()
const inputRef = ref()

// ==================== Computed ====================

/**
 * 是否可以发送消息
 */
const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && !isProcessing.value
})

/**
 * 是否为 Mac 系统
 */
const isMac = computed(() => {
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
})

// ==================== Methods ====================

/**
 * 格式化数字
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * 获取上下文项目数量
 */
function getContextItemCount(context: ContextInfo): number {
  let count = 0
  if (context.sessions?.length) count += context.sessions.length
  if (context.users?.length) count += context.users.length
  if (context.messages?.length) count += context.messages.length
  if (context.timeRange) count += 1
  return count
}

/**
 * 聚焦输入框
 */
function focusInput(): void {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

/**
 * 滚动到底部
 */
function scrollToBottom(smooth = true): void {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  })
}

/**
 * 检查是否需要显示滚动按钮
 */
function checkScrollButton(): void {
  if (messagesContainer.value) {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
    showScrollButton.value = scrollHeight - scrollTop - clientHeight > 100
  }
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event: KeyboardEvent): void {
  // Ctrl+Enter 或 Cmd+Enter 发送
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    handleSendMessage()
  }
}

/**
 * 发送消息
 */
async function handleSendMessage(): Promise<void> {
  if (!canSend.value) return

  const content = inputMessage.value.trim()
  const context = currentContext.value

  // 清空输入
  inputMessage.value = ''

  try {
    // 如果没有当前对话，创建新对话
    if (!currentConversation.value) {
      const conversationId = await conversationStore.createConversation()
      emit('conversation-created', conversationId)
    }

    // 发送消息
    await conversationStore.sendMessage(content, context || undefined)
    
    emit('message-sent')

    // 滚动到底部
    if (autoScroll.value) {
      scrollToBottom()
    }

    // 聚焦输入框
    focusInput()
  } catch (err: any) {
    console.error('发送消息失败:', err)
    ElMessage.error(err.message || '发送消息失败')
  }
}

/**
 * 停止生成
 */
function handleStopGeneration(): void {
  // TODO: 实现停止生成功能
  ElMessage.info('停止生成功能开发中')
}

/**
 * 重试消息
 */
async function handleRetryMessage(_message: MessageRecord): Promise<void> {
  try {
    await conversationStore.retryLastMessage()
    
    if (autoScroll.value) {
      scrollToBottom()
    }
  } catch (err: any) {
    console.error('重试失败:', err)
    ElMessage.error(err.message || '重试失败')
  }
}

/**
 * 删除消息
 */
async function handleDeleteMessage(message: MessageRecord): Promise<void> {
  try {
    await conversationStore.deleteMessage(message.id)
    ElMessage.success('消息已删除')
  } catch (err: any) {
    console.error('删除失败:', err)
    ElMessage.error(err.message || '删除失败')
  }
}

/**
 * 复制消息
 */
function handleCopyMessage(_content: string): void {
  // 已在 AIMessageBubble 中处理
}

/**
 * 清空消息
 */
async function handleClearMessages(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清空当前对话的所有消息吗？此操作无法撤销。',
      '清空确认',
      {
        type: 'warning',
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    // 删除所有消息
    for (const message of currentMessages.value) {
      if (message.id) {
        await conversationStore.deleteMessage(message.id)
      }
    }
    
    ElMessage.success('已清空所有消息')
  } catch {
    // 用户取消
  }
}

/**
 * 导出对话
 */
function handleExportConversation(): void {
  try {
    const markdown = conversationStore.exportConversationAsMarkdown()
    
    // 创建下载链接
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentConversation.value?.title || '对话'}_${new Date().toISOString().slice(0, 10)}.md`
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (err: any) {
    console.error('导出失败:', err)
    ElMessage.error(err.message || '导出失败')
  }
}

/**
 * 提示词选择
 */
function handlePromptSelect(prompt: Prompt): void {
  // 将提示词内容填入输入框
  inputMessage.value = prompt.content
  showPromptSelector.value = false
  focusInput()
}

/**
 * 引用确认
 */
function handleReferenceConfirm(): void {
  // 从 store 获取当前上下文
  const context = currentContext.value
  if (context) {
    conversationStore.setContext(context)
    ElMessage.success('已添加上下文引用')
  }
  showReferenceSelector.value = false
  focusInput()
}

/**
 * 清除上下文
 */
function handleClearContext(): void {
  conversationStore.clearContext()
  ElMessage.success('已清除上下文')
}

/**
 * 移除上下文会话
 */
function handleRemoveContextSession(sessionId: string): void {
  if (!currentContext.value) return
  currentContext.value.sessions = currentContext.value.sessions?.filter((id: string) => id !== sessionId)
}

/**
 * 移除上下文用户
 */
function handleRemoveContextUser(userId: string): void {
  if (!currentContext.value) return
  currentContext.value.users = currentContext.value.users?.filter((id: string) => id !== userId)
}

/**
 * 移除上下文消息
 */
function handleRemoveContextMessages(): void {
  if (!currentContext.value) return
  currentContext.value.messages = []
}

/**
 * 移除上下文时间范围
 */
function handleRemoveContextTimeRange(): void {
  if (!currentContext.value) return
  currentContext.value.timeRange = undefined
}

/**
 * 重建上下文
 */
function handleRebuildContext(): void {
  // 触发 ReferenceStore 重建上下文
  ElMessage.info('重建上下文功能开发中')
}

/**
 * 复制上下文
 */
function handleCopyContext(_text: string): void {
  // 已在 ContextPreview 中处理
  ElMessage.success('已复制上下文')
}

// ==================== Lifecycle ====================

/**
 * 监听消息变化，自动滚动
 */
watch(
  () => currentMessages.value.length,
  () => {
    if (autoScroll.value) {
      nextTick(() => scrollToBottom())
    }
  }
)

/**
 * 监听流式内容变化，自动滚动
 */
watch(
  streamingContent,
  () => {
    if (autoScroll.value) {
      nextTick(() => scrollToBottom(false))
    }
  }
)

/**
 * 监听对话变化
 */
watch(
  () => props.conversationId,
  async (newId: number | null | undefined) => {
    if (newId) {
      const conversation = conversationStore.conversations.find((c: any) => c.id === newId)
      if (conversation) {
        await conversationStore.setCurrentConversation(conversation)
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  // 监听滚动事件
  messagesContainer.value?.addEventListener('scroll', checkScrollButton)
  
  // 初始化滚动
  scrollToBottom(false)
})

onUnmounted(() => {
  messagesContainer.value?.removeEventListener('scroll', checkScrollButton)
})
</script>

<style scoped lang="scss">
.ai-conversation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conversation-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.token-tooltip {
  font-size: 12px;
  line-height: 1.6;
}

.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

.messages-list {
  position: relative;
  min-height: 100%;
}

.scroll-to-bottom {
  position: fixed;
  bottom: 220px;
  right: 40px;
  z-index: 10;
  box-shadow: var(--el-box-shadow-light);
}

.input-area {
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  padding: 16px 20px;
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.char-count,
.shortcut-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.context-badge {
  margin-left: 4px;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

// 滚动条样式
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;

  &:hover {
    background: var(--el-border-color-darker);
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 移动端适配
@media (max-width: 768px) {
  .panel-header {
    padding: 12px 16px;
  }

  .conversation-title {
    font-size: 16px;
  }

  .context-bar {
    padding: 8px 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .messages-container {
    padding: 12px;
  }

  .scroll-to-bottom {
    bottom: 180px;
    right: 20px;
  }

  .input-area {
    padding: 12px 16px;
  }

  .input-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>