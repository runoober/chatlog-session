<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Close,
  Delete,
  CopyDocument,
  Star,
  Download,
  Select,
  CircleCheck,
  ArrowDown,
} from '@element-plus/icons-vue'
import { useBatchSelectionStore } from '@/stores/batchSelection'
import type { Message } from '@/types'

interface Props {
  allMessages?: Message[]
}

const props = withDefaults(defineProps<Props>(), {
  allMessages: () => [],
})

const emit = defineEmits<{
  delete: [messageIds: number[]]
  favorite: [messageIds: number[]]
  export: []
}>()

const batchStore = useBatchSelectionStore()

// 选中数量
const selectedCount = computed(() => batchStore.selectedCount)

// 是否全选
const isAllSelected = computed(() => {
  if (props.allMessages.length === 0) return false
  return selectedCount.value === props.allMessages.length
})

// 退出批量选择
const handleExit = () => {
  batchStore.deactivate()
}

// 全选
const handleSelectAll = () => {
  if (isAllSelected.value) {
    batchStore.clear()
  } else {
    batchStore.selectAll(props.allMessages)
  }
}

// 反选
const handleInvert = () => {
  batchStore.invertSelection(props.allMessages)
}

// 复制
const handleCopy = async () => {
  const success = await batchStore.copyToClipboard()
  if (success) {
    ElMessage.success(`已复制 ${selectedCount.value} 条消息`)
  } else {
    ElMessage.error('复制失败')
  }
}

// 收藏
const handleFavorite = () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择消息')
    return
  }

  const messageIds = Array.from(batchStore.selectedMessageIds)
  emit('favorite', messageIds)
  ElMessage.success(`已收藏 ${selectedCount.value} 条消息`)
  batchStore.deactivate()
}

// 删除
const handleDelete = () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择消息')
    return
  }

  ElMessageBox.confirm(`确定要删除选中的 ${selectedCount.value} 条消息吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
    confirmButtonClass: 'el-button--danger',
  })
    .then(() => {
      const messageIds = Array.from(batchStore.selectedMessageIds)
      emit('delete', messageIds)
      ElMessage.success(`已删除 ${selectedCount.value} 条消息`)
      batchStore.deactivate()
    })
    .catch(() => {
      // 取消删除
    })
}

// 导出
const handleExport = () => {
  if (selectedCount.value === 0) {
    ElMessage.warning('请先选择消息')
    return
  }

  emit('export')
  ElMessage.success('导出功能开发中...')
}
const handleCommand = (command: string) => {
  switch (command) {
    case 'copy':
      handleCopy()
      break
    case 'favorite':
      handleFavorite()
      break
    case 'export':
      handleExport()
      break
    case 'delete':
      handleDelete()
      break
  }
}
</script>

<template>
  <div v-if="batchStore.isActive" class="batch-selection-toolbar">
    <!-- 左侧：退出和选择信息 -->
    <div class="toolbar-left">
      <el-button text circle @click="handleExit">
        <el-icon :size="20">
          <Close />
        </el-icon>
      </el-button>

      <div class="selection-info">
        <span class="count">已选中 {{ selectedCount }} 条</span>
      </div>
    </div>

    <!-- 右侧：操作按钮 -->
    <div class="toolbar-right">
      <!-- 全选/取消全选 -->
      <el-button text @click="handleSelectAll">
        <el-icon>
          <CircleCheck v-if="isAllSelected" />
          <Select v-else />
        </el-icon>
        <span>{{ isAllSelected ? '取消全选' : '全选' }}</span>
      </el-button>

      <!-- 反选 -->
      <el-button text @click="handleInvert"> 反选 </el-button>

      <!-- 更多操作 -->
      <el-dropdown trigger="click" @command="handleCommand">
        <el-button text>
          更多操作
          <el-icon class="el-icon--right">
            <ArrowDown />
          </el-icon>
        </el-button>

        <template #dropdown>
          <el-dropdown-menu>
            <!-- 复制 -->
            <el-dropdown-item command="copy" :icon="CopyDocument"> 复制内容 </el-dropdown-item>

            <!-- 收藏 -->
            <el-dropdown-item command="favorite" :icon="Star"> 收藏消息 </el-dropdown-item>

            <!-- 导出 -->
            <el-dropdown-item command="export" :icon="Download" divided>
              导出消息
            </el-dropdown-item>

            <!-- 删除 -->
            <el-dropdown-item command="delete" :icon="Delete" divided>
              <span style="color: var(--el-color-danger)">删除消息</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.batch-selection-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1000;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);

  // 移动端适配
  @media (max-width: 768px) {
    padding: 0 8px;
    padding-bottom: env(safe-area-inset-bottom);
  }
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .count {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;

  // 移动端隐藏部分按钮
  @media (max-width: 768px) {
    > .el-button:not(:last-child) {
      display: none;
    }
  }
}

// 暗色模式
.dark {
  .batch-selection-toolbar {
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
  }
}
</style>
