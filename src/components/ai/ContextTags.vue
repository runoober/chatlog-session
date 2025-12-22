<!--
  上下文标签展示组件
  用于展示消息中引用的上下文信息（会话、用户、时间范围等）
-->
<template>
  <div class="context-tags">
    <div v-if="hasContext" class="tags-container">
      <!-- 会话标签 -->
      <el-tag
        v-for="sessionId in context?.sessions?.slice(0, maxVisibleTags)"
        :key="`session-${sessionId}`"
        size="small"
        type="primary"
        :closable="closable"
        @close="handleRemoveSession(sessionId)"
      >
        <el-icon><ChatDotRound /></el-icon>
        <span class="tag-text">{{ sessionId }}</span>
      </el-tag>

      <!-- 用户标签 -->
      <el-tag
        v-for="userId in context?.users?.slice(0, maxVisibleTags)"
        :key="`user-${userId}`"
        size="small"
        type="success"
        :closable="closable"
        @close="handleRemoveUser(userId)"
      >
        <el-icon><User /></el-icon>
        <span class="tag-text">{{ userId }}</span>
      </el-tag>

      <!-- 消息数量标签 -->
      <el-tag
        v-if="context?.messages && context.messages.length > 0"
        size="small"
        type="info"
        :closable="closable"
        @close="handleRemoveMessages"
      >
        <el-icon><ChatLineRound /></el-icon>
        <span class="tag-text">{{ context.messages.length }} 条消息</span>
      </el-tag>

      <!-- 时间范围标签 -->
      <el-tag
        v-if="context?.timeRange"
        size="small"
        type="warning"
        :closable="closable"
        @close="handleRemoveTimeRange"
      >
        <el-icon><Calendar /></el-icon>
        <span class="tag-text">{{ formatTimeRange(context.timeRange) }}</span>
      </el-tag>

      <!-- 更多标签提示 -->
      <el-tag
        v-if="hasMoreTags"
        size="small"
        class="more-tag"
        @click="showAllTags = !showAllTags"
      >
        {{ showAllTags ? '收起' : `+${moreTagsCount} 更多` }}
      </el-tag>

      <!-- Token 统计 -->
      <el-tag
        v-if="context?.tokenCount && showTokenCount"
        size="small"
        effect="plain"
        class="token-tag"
      >
        <el-icon><Tickets /></el-icon>
        <span class="tag-text">{{ context.tokenCount.toLocaleString() }} tokens</span>
      </el-tag>
    </div>

    <div v-else class="empty-state">
      <el-icon><InfoFilled /></el-icon>
      <span>{{ emptyText }}</span>
    </div>

    <!-- 详情按钮 -->
    <el-button
      v-if="hasContext && showDetailButton"
      text
      size="small"
      @click="handleShowDetail"
    >
      <el-icon><View /></el-icon>
      查看详情
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ChatDotRound,
  User,
  ChatLineRound,
  Calendar,
  Tickets,
  InfoFilled,
  View
} from '@element-plus/icons-vue'
import type { ContextInfo, TimeRange } from '@/types/ai'

// ==================== Props & Emits ====================

interface Props {
  /** 上下文信息 */
  context: ContextInfo | null
  /** 标签是否可关闭 */
  closable?: boolean
  /** 是否显示 Token 数量 */
  showTokenCount?: boolean
  /** 是否显示详情按钮 */
  showDetailButton?: boolean
  /** 最大可见标签数（超出显示"更多"） */
  maxVisibleTags?: number
  /** 空状态文本 */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  closable: false,
  showTokenCount: true,
  showDetailButton: true,
  maxVisibleTags: 3,
  emptyText: '暂无上下文'
})

interface Emits {
  (e: 'remove-session', sessionId: string): void
  (e: 'remove-user', userId: string): void
  (e: 'remove-messages'): void
  (e: 'remove-time-range'): void
  (e: 'show-detail'): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const showAllTags = ref(false)

// ==================== Computed ====================

/**
 * 是否有上下文
 */
const hasContext = computed(() => {
  if (!props.context) return false
  
  return (
    (props.context.sessions && props.context.sessions.length > 0) ||
    (props.context.users && props.context.users.length > 0) ||
    (props.context.messages && props.context.messages.length > 0) ||
    !!props.context.timeRange
  )
})

/**
 * 是否有更多标签
 */
const hasMoreTags = computed(() => {
  if (!props.context) return false
  
  const sessionsCount = props.context.sessions?.length || 0
  const usersCount = props.context.users?.length || 0
  
  return (sessionsCount + usersCount) > props.maxVisibleTags && !showAllTags.value
})

/**
 * 更多标签的数量
 */
const moreTagsCount = computed(() => {
  if (!props.context) return 0
  
  const sessionsCount = props.context.sessions?.length || 0
  const usersCount = props.context.users?.length || 0
  const total = sessionsCount + usersCount
  
  return Math.max(0, total - props.maxVisibleTags)
})

// ==================== Methods ====================

/**
 * 格式化时间范围
 */
function formatTimeRange(range: TimeRange): string {
  const start = new Date(range.start)
  const end = new Date(range.end)
  
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }
  
  // 如果是同一天
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start)
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
}

/**
 * 移除会话
 */
function handleRemoveSession(sessionId: string): void {
  emit('remove-session', sessionId)
}

/**
 * 移除用户
 */
function handleRemoveUser(userId: string): void {
  emit('remove-user', userId)
}

/**
 * 移除消息
 */
function handleRemoveMessages(): void {
  emit('remove-messages')
}

/**
 * 移除时间范围
 */
function handleRemoveTimeRange(): void {
  emit('remove-time-range')
}

/**
 * 显示详情
 */
function handleShowDetail(): void {
  emit('show-detail')
}
</script>

<style scoped lang="scss">
.context-tags {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tags-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.el-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;

  .el-icon {
    font-size: 12px;
  }
}

.tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-tag {
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }
}

.token-tag {
  border-style: dashed;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);

  .el-icon {
    font-size: 14px;
  }
}

// 移动端适配
@media (max-width: 768px) {
  .context-tags {
    flex-direction: column;
    align-items: flex-start;
  }

  .tags-container {
    width: 100%;
  }

  .el-tag {
    max-width: 150px;
  }
}
</style>