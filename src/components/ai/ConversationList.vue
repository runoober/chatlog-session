<!--
  对话历史列表组件
  用于展示和管理 AI 对话历史
-->
<template>
  <div class="conversation-list">
    <!-- 头部：标题和操作 -->
    <div class="list-header">
      <h3 class="header-title">
        <el-icon><ChatDotRound /></el-icon>
        对话历史
      </h3>
      
      <el-button
        type="primary"
        size="small"
        @click="handleCreateConversation"
      >
        <el-icon><Plus /></el-icon>
        新建对话
      </el-button>
    </div>

    <!-- 搜索框 -->
    <div v-if="showSearch" class="list-search">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索对话..."
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 对话列表 -->
    <div class="list-container" :style="{ height: listHeight }">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredConversations.length === 0" class="empty-state">
        <el-empty 
          :description="searchKeyword ? '未找到匹配的对话' : emptyText"
          :image-size="80"
        >
          <el-button v-if="!searchKeyword" type="primary" @click="handleCreateConversation">
            创建第一个对话
          </el-button>
        </el-empty>
      </div>

      <!-- 对话项列表 -->
      <div v-else class="list-items">
        <div
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          :class="[
            'conversation-item',
            { active: currentConversationId === conversation.id }
          ]"
          @click="handleSelectConversation(conversation)"
        >
          <!-- 对话信息 -->
          <div class="item-content">
            <div class="item-header">
              <h4 class="item-title" :title="conversation.title">
                {{ conversation.title }}
              </h4>
              
              <!-- 操作按钮 -->
              <el-dropdown
                trigger="click"
                @command="(cmd) => handleCommand(cmd, conversation)"
                @click.stop
              >
                <el-button text circle size="small" class="item-more">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename" :icon="Edit">
                      重命名
                    </el-dropdown-item>
                    <el-dropdown-item command="export" :icon="Download">
                      导出
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" :icon="Delete" divided>
                      <span style="color: var(--el-color-danger)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <div class="item-meta">
              <span class="meta-time">
                {{ formatTime(conversation.updatedAt) }}
              </span>
              
              <el-space :size="8" class="meta-stats">
                <span v-if="conversation.totalTokens" class="stat-item">
                  <el-icon><Tickets /></el-icon>
                  {{ formatNumber(conversation.totalTokens) }}
                </span>
                <span v-if="conversation.totalCost" class="stat-item stat-cost">
                  <el-icon><Money /></el-icon>
                  ${{ conversation.totalCost.toFixed(4) }}
                </span>
              </el-space>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <el-dialog
      v-model="showRenameDialog"
      title="重命名对话"
      width="400px"
    >
      <el-form @submit.prevent="handleRenameSubmit">
        <el-form-item label="对话标题">
          <el-input
            v-model="renameTitle"
            placeholder="请输入对话标题"
            maxlength="100"
            show-word-limit
            autofocus
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRenameSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ChatDotRound,
  Plus,
  Search,
  Loading,
  MoreFilled,
  Edit,
  Download,
  Delete,
  Tickets,
  Money
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ConversationRecord } from '@/types/ai'

// ==================== Props & Emits ====================

interface Props {
  /** 对话列表 */
  conversations: ConversationRecord[]
  /** 当前对话 ID */
  currentConversationId?: number | null
  /** 是否加载中 */
  loading?: boolean
  /** 是否显示搜索框 */
  showSearch?: boolean
  /** 列表高度 */
  listHeight?: string
  /** 空状态文本 */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentConversationId: null,
  loading: false,
  showSearch: true,
  listHeight: 'auto',
  emptyText: '还没有对话，创建一个开始吧'
})

interface Emits {
  (e: 'create'): void
  (e: 'select', conversation: ConversationRecord): void
  (e: 'rename', conversationId: number, title: string): void
  (e: 'delete', conversationId: number): void
  (e: 'export', conversationId: number): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const searchKeyword = ref('')
const showRenameDialog = ref(false)
const renameTitle = ref('')
const renamingConversation = ref<ConversationRecord | null>(null)

// ==================== Computed ====================

/**
 * 过滤后的对话列表
 */
const filteredConversations = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.conversations
  }

  const keyword = searchKeyword.value.toLowerCase()
  return props.conversations.filter(conversation => 
    conversation.title.toLowerCase().includes(keyword)
  )
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

  // 小于 7 天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days} 天前`
  }

  // 今年内
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }

  // 完整日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

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
 * 搜索对话
 */
function handleSearch(): void {
  // 搜索逻辑已在 computed 中处理
}

/**
 * 创建新对话
 */
function handleCreateConversation(): void {
  emit('create')
}

/**
 * 选择对话
 */
function handleSelectConversation(conversation: ConversationRecord): void {
  emit('select', conversation)
}

/**
 * 处理命令
 */
async function handleCommand(command: string, conversation: ConversationRecord): Promise<void> {
  switch (command) {
    case 'rename':
      handleRename(conversation)
      break
    case 'export':
      handleExport(conversation)
      break
    case 'delete':
      await handleDelete(conversation)
      break
  }
}

/**
 * 重命名对话
 */
function handleRename(conversation: ConversationRecord): void {
  renamingConversation.value = conversation
  renameTitle.value = conversation.title
  showRenameDialog.value = true
}

/**
 * 提交重命名
 */
function handleRenameSubmit(): void {
  if (!renamingConversation.value) return

  const title = renameTitle.value.trim()
  if (!title) {
    ElMessage.warning('请输入对话标题')
    return
  }

  emit('rename', renamingConversation.value.id!, title)
  showRenameDialog.value = false
  ElMessage.success('重命名成功')
}

/**
 * 导出对话
 */
function handleExport(conversation: ConversationRecord): void {
  emit('export', conversation.id!)
}

/**
 * 删除对话
 */
async function handleDelete(conversation: ConversationRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除对话"${conversation.title}"吗？此操作无法撤销。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
    emit('delete', conversation.id!)
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  .el-icon {
    font-size: 18px;
    color: var(--el-color-primary);
  }
}

.list-search {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.list-container {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: var(--el-text-color-secondary);

  .el-icon {
    font-size: 24px;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 20px;
}

.list-items {
  padding: 8px;
}

.conversation-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: var(--el-fill-color-light);
    transform: translateX(4px);

    .item-more {
      opacity: 1;
    }
  }

  &.active {
    background: var(--el-color-primary-light-9);
    border-left: 3px solid var(--el-color-primary);

    .item-title {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.item-content {
  width: 100%;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}

.item-more {
  opacity: 0;
  transition: opacity 0.3s;
  flex-shrink: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-time {
  flex-shrink: 0;
}

.meta-stats {
  flex: 1;
  justify-content: flex-end;
}

.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;

  .el-icon {
    font-size: 12px;
  }
}

.stat-cost {
  color: var(--el-color-warning);
  font-weight: 500;
}

// 滚动条样式
.list-container::-webkit-scrollbar {
  width: 6px;
}

.list-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;

  &:hover {
    background: var(--el-border-color-darker);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .list-header {
    padding: 12px;
  }

  .list-search {
    padding: 8px 12px;
  }

  .list-items {
    padding: 4px;
  }

  .conversation-item {
    padding: 10px;

    .item-more {
      opacity: 1; // 移动端始终显示
    }
  }

  .item-title {
    font-size: 13px;
  }

  .item-meta {
    font-size: 11px;
  }
}
</style>