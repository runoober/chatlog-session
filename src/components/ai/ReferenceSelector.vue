<template>
  <div class="reference-selector">
    <!-- 头部 -->
    <div class="reference-header">
      <div class="header-left">
        <el-icon class="header-icon"><Link /></el-icon>
        <span class="header-title">引用选择器</span>
        <el-tag v-if="hasReferences" size="small" type="primary">
          {{ referenceCount }} 个引用
        </el-tag>
      </div>
      <div class="header-right">
        <el-button
          v-if="hasReferences"
          size="small"
          text
          @click="handleClearAll"
        >
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
        <el-button
          v-if="showPreview"
          size="small"
          type="primary"
          @click="handlePreviewContext"
        >
          <el-icon><View /></el-icon>
          预览上下文
        </el-button>
      </div>
    </div>

    <!-- 引用类型选择 -->
    <div class="reference-tabs">
      <el-radio-group v-model="currentTab" size="small">
        <el-radio-button value="session">
          <el-icon><ChatDotRound /></el-icon>
          会话 ({{ sessionReferences.length }})
        </el-radio-button>
        <el-radio-button value="user">
          <el-icon><User /></el-icon>
          用户 ({{ userReferences.length }})
        </el-radio-button>
        <el-radio-button value="message">
          <el-icon><ChatLineRound /></el-icon>
          消息 ({{ messageReferences.length }})
        </el-radio-button>
        <el-radio-button value="timeRange">
          <el-icon><Clock /></el-icon>
          时间范围
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 内容区域 -->
    <div class="reference-content">
      <!-- 会话选择 -->
      <div v-show="currentTab === 'session'" class="tab-content">
        <SessionSelector
          :selectable="true"
          :multiple="true"
          @select="handleSessionSelect"
        />
      </div>

      <!-- 用户选择 -->
      <div v-show="currentTab === 'user'" class="tab-content">
        <UserSelector
          :selectable="true"
          :multiple="true"
          @select="handleUserSelect"
        />
      </div>

      <!-- 消息选择 -->
      <div v-show="currentTab === 'message'" class="tab-content">
        <MessageSelector
          :selectable="true"
          :multiple="true"
          @select="handleMessageSelect"
        />
      </div>

      <!-- 时间范围选择 -->
      <div v-show="currentTab === 'timeRange'" class="tab-content">
        <TimeRangeSelector
          v-model="currentTimeRange"
          @change="handleTimeRangeChange"
        />
      </div>
    </div>

    <!-- 已选引用列表 -->
    <div v-if="hasReferences" class="selected-references">
      <div class="section-title">
        <span>已选引用</span>
        <span class="token-info" :class="{ 'token-warning': isOverTokenLimit }">
          <el-icon><Memo /></el-icon>
          {{ estimatedTokens }} / {{ maxTokens }} tokens
          <span v-if="isOverTokenLimit" class="warning-text">(超出限制)</span>
        </span>
      </div>

      <div class="reference-list">
        <el-tag
          v-for="ref in currentReferences"
          :key="ref.id"
          :type="getReferenceTagType(ref.type) as any"
          closable
          size="large"
          @close="handleRemoveReference(ref.id)"
        >
          <el-icon class="tag-icon">
            <component :is="getReferenceIcon(ref.type)" />
          </el-icon>
          {{ ref.label }}
        </el-tag>
      </div>

      <!-- 引用摘要 -->
      <div class="reference-summary">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ referenceSummary }}</span>
      </div>
    </div>

    <!-- 上下文构建配置 -->
    <div v-if="showBuildConfig" class="build-config">
      <el-divider />
      
      <div class="config-section">
        <div class="config-label">
          <el-icon><Operation /></el-icon>
          <span>构建策略</span>
        </div>
        <el-select v-model="buildStrategy" size="small">
          <el-option value="smart" label="智能采样">
            <span>智能采样</span>
            <span class="option-desc">基于优先级规则选择重要消息</span>
          </el-option>
          <el-option value="recent" label="最近优先">
            <span>最近优先</span>
            <span class="option-desc">选择最新的消息</span>
          </el-option>
          <el-option value="random" label="随机采样">
            <span>随机采样</span>
            <span class="option-desc">随机选择消息</span>
          </el-option>
          <el-option value="hierarchical" label="分层摘要">
            <span>分层摘要</span>
            <span class="option-desc">生成多层级摘要</span>
          </el-option>
        </el-select>
      </div>

      <div class="config-section">
        <div class="config-label">
          <el-icon><Coin /></el-icon>
          <span>最大 Token 数</span>
        </div>
        <el-input-number
          v-model="maxTokens"
          :min="1000"
          :max="128000"
          :step="1000"
          size="small"
          @change="handleMaxTokensChange"
        />
      </div>

      <!-- Token 使用率进度条 -->
      <div class="token-progress">
        <el-progress
          :percentage="tokenUsageRate"
          :color="getProgressColor(tokenUsageRate)"
          :stroke-width="8"
        />
      </div>
    </div>

    <!-- 快捷选择 -->
    <div v-if="showQuickSelect && currentTab === 'timeRange'" class="quick-select">
      <el-divider content-position="left">快捷选择</el-divider>
      <div class="quick-buttons">
        <el-button size="small" @click="handleSelectToday">今天</el-button>
        <el-button size="small" @click="handleSelectThisWeek">本周</el-button>
        <el-button size="small" @click="handleSelectThisMonth">本月</el-button>
        <el-button size="small" @click="handleSelectRecentDays(7)">最近 7 天</el-button>
        <el-button size="small" @click="handleSelectRecentDays(30)">最近 30 天</el-button>
      </div>
    </div>

    <!-- 上下文预览对话框 -->
    <el-dialog
      v-model="showPreviewDialog"
      title="上下文预览"
      width="800px"
      :close-on-click-modal="false"
    >
      <ContextPreview
        :references="currentReferences"
        :strategy="buildStrategy"
        :max-tokens="maxTokens"
      />
      
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
        <el-button type="primary" @click="handleConfirmPreview">
          <el-icon><Check /></el-icon>
          确认使用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Link,
  Delete,
  View,
  ChatDotRound,
  User,
  ChatLineRound,
  Clock,
  Memo,
  InfoFilled,
  Operation,
  Coin,
  Check
} from '@element-plus/icons-vue'
import { useReferenceStore } from '@/stores/ai/reference'
import SessionSelector from './SessionSelector.vue'
import UserSelector from './UserSelector.vue'
import MessageSelector from './MessageSelector.vue'
import TimeRangeSelector from './TimeRangeSelector.vue'
import ContextPreview from './ContextPreview.vue'
import type { Reference, ContextBuildStrategy } from '@/types/ai'

// ==================== Props & Emits ====================

interface Props {
  /** 是否显示预览按钮 */
  showPreview?: boolean
  /** 是否显示构建配置 */
  showBuildConfig?: boolean
  /** 是否显示快捷选择 */
  showQuickSelect?: boolean
  /** 初始选中的标签页 */
  initialTab?: 'session' | 'user' | 'message' | 'timeRange'
}

const props = withDefaults(defineProps<Props>(), {
  showPreview: true,
  showBuildConfig: true,
  showQuickSelect: true,
  initialTab: 'session'
})

interface Emits {
  (e: 'change', references: Reference[]): void
  (e: 'preview', context: string): void
  (e: 'confirm'): void
}

const emit = defineEmits<Emits>()

// ==================== Store ====================

const referenceStore = useReferenceStore()

// ==================== State ====================

const currentTab = ref<'session' | 'user' | 'message' | 'timeRange'>(props.initialTab)
const selectedSessionIds = ref<string[]>([])
const selectedUserIds = ref<string[]>([])
const selectedMessageIds = ref<number[]>([])
const currentTimeRange = ref<{ start: string; end: string } | null>(null)
const showPreviewDialog = ref(false)

// ==================== Computed ====================

const currentReferences = computed(() => referenceStore.currentReferences)
const referenceCount = computed(() => referenceStore.referenceCount)
const hasReferences = computed(() => referenceStore.hasReferences)
const sessionReferences = computed(() => referenceStore.sessionReferences)
const userReferences = computed(() => referenceStore.userReferences)
const messageReferences = computed(() => referenceStore.messageReferences)
const referenceSummary = computed(() => referenceStore.referenceSummary)
const estimatedTokens = computed(() => referenceStore.estimatedTokens)
const tokenUsageRate = computed(() => referenceStore.tokenUsageRate)
const isOverTokenLimit = computed(() => referenceStore.isOverTokenLimit)

const buildStrategy = computed({
  get: () => referenceStore.buildStrategy,
  set: (value: ContextBuildStrategy) => referenceStore.setBuildStrategy(value)
})

const maxTokens = computed({
  get: () => referenceStore.maxTokens,
  set: (value: number) => referenceStore.setMaxTokens(value)
})

// ==================== Methods ====================

/**
 * 获取引用标签类型
 */
function getReferenceTagType(type: string): string {
  const typeMap: Record<string, string> = {
    session: 'primary',
    user: 'success',
    message: 'warning',
    timeRange: 'info'
  }
  return typeMap[type] || 'info'
}

/**
 * 获取引用图标
 */
function getReferenceIcon(type: string) {
  const iconMap: Record<string, any> = {
    session: ChatDotRound,
    user: User,
    message: ChatLineRound,
    timeRange: Clock
  }
  return iconMap[type] || InfoFilled
}

/**
 * 获取进度条颜色
 */
function getProgressColor(percentage: number): string {
  if (percentage < 60) return '#67c23a'
  if (percentage < 85) return '#e6a23c'
  return '#f56c6c'
}

/**
 * 处理会话选择
 */
function handleSessionSelect() {
  // 会话选择器处理选择逻辑
  emit('change', currentReferences.value)
}

/**
 * 处理用户选择
 */
function handleUserSelect() {
  // 用户选择器处理选择逻辑
  emit('change', currentReferences.value)
}

/**
 * 处理消息选择
 */
function handleMessageSelect() {
  // 消息选择器处理选择逻辑
  emit('change', currentReferences.value)
}

/**
 * 处理时间范围变化
 */
function handleTimeRangeChange(range: { start: string; end: string } | null) {
  if (range) {
    referenceStore.setTimeRange(range.start, range.end)
  } else {
    referenceStore.clearTimeRange()
  }
  emit('change', currentReferences.value)
}

/**
 * 移除引用
 */
function handleRemoveReference(referenceId: string) {
  referenceStore.removeReference(referenceId)
  
  // 同步更新本地选择状态
  selectedSessionIds.value = referenceStore.selectedSessions
  selectedUserIds.value = referenceStore.selectedUsers
  selectedMessageIds.value = referenceStore.selectedMessages
  
  emit('change', currentReferences.value)
}

/**
 * 清空所有引用
 */
async function handleClearAll() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有引用吗？',
      '提示',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    )
    
    referenceStore.clearAllReferences()
    selectedSessionIds.value = []
    selectedUserIds.value = []
    selectedMessageIds.value = []
    currentTimeRange.value = null
    
    ElMessage.success('已清空所有引用')
    emit('change', currentReferences.value)
  } catch {
    // 用户取消
  }
}

/**
 * 预览上下文
 */
function handlePreviewContext() {
  if (!hasReferences.value) {
    ElMessage.warning('请先选择引用')
    return
  }
  showPreviewDialog.value = true
}

/**
 * 确认预览
 */
function handleConfirmPreview() {
  showPreviewDialog.value = false
  emit('confirm')
}

/**
 * 处理最大 Token 数变化
 */
function handleMaxTokensChange(value: number | undefined) {
  if (value) {
    referenceStore.setMaxTokens(value)
  }
}

/**
 * 快捷选择：今天
 */
function handleSelectToday() {
  referenceStore.selectToday()
  emit('change', currentReferences.value)
}

/**
 * 快捷选择：本周
 */
function handleSelectThisWeek() {
  referenceStore.selectThisWeek()
  emit('change', currentReferences.value)
}

/**
 * 快捷选择：本月
 */
function handleSelectThisMonth() {
  referenceStore.selectThisMonth()
  emit('change', currentReferences.value)
}

/**
 * 快捷选择：最近 N 天
 */
function handleSelectRecentDays(days: number) {
  referenceStore.selectRecentDays(days)
  emit('change', currentReferences.value)
}

// ==================== Watch ====================

// 监听 store 中的选择变化，同步到本地状态
watch(
  () => referenceStore.selectedSessions,
  (newVal) => {
    selectedSessionIds.value = [...newVal]
  }
)

watch(
  () => referenceStore.selectedUsers,
  (newVal) => {
    selectedUserIds.value = [...newVal]
  }
)

watch(
  () => referenceStore.selectedMessages,
  (newVal) => {
    selectedMessageIds.value = [...newVal]
  }
)

watch(
  () => referenceStore.timeRange,
  (newVal) => {
    currentTimeRange.value = newVal ? { ...newVal } : null
  }
)
</script>

<style scoped lang="scss">
.reference-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
}

// 头部
.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .header-icon {
      font-size: 20px;
      color: var(--el-color-primary);
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

// 标签页
.reference-tabs {
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);

  :deep(.el-radio-button) {
    .el-radio-button__inner {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
    }
  }
}

// 内容区域
.reference-content {
  flex: 1;
  overflow: hidden;

  .tab-content {
    height: 100%;
    overflow: auto;
  }
}

// 已选引用列表
.selected-references {
  padding: 16px 20px;
  background: var(--el-bg-color-page);
  border-top: 1px solid var(--el-border-color);

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);

    .token-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: normal;
      color: var(--el-text-color-secondary);

      &.token-warning {
        color: var(--el-color-danger);
      }

      .warning-text {
        font-weight: 600;
      }
    }
  }

  .reference-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;

    .el-tag {
      max-width: 100%;

      .tag-icon {
        margin-right: 4px;
      }
    }
  }

  .reference-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

// 构建配置
.build-config {
  padding: 0 20px 16px;

  .config-section {
    margin-bottom: 16px;

    .config-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .el-select,
    .el-input-number {
      width: 100%;
    }

    .option-desc {
      margin-left: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .token-progress {
    margin-top: 12px;
  }
}

// 快捷选择
.quick-select {
  padding: 0 20px 16px;

  .quick-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

// 响应式
@media (max-width: 768px) {
  .reference-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-right {
      width: 100%;
      justify-content: flex-end;
    }
  }

  .reference-tabs {
    :deep(.el-radio-group) {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .el-radio-button {
        flex: 1;
      }
    }
  }

  .selected-references {
    .section-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }

  .quick-select {
    .quick-buttons {
      .el-button {
        flex: 1 1 calc(50% - 4px);
      }
    }
  }
}
</style>