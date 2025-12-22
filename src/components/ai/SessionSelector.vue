<template>
  <div class="session-selector">
    <el-select
      :model-value="modelValue"
      :multiple="multiple"
      :placeholder="placeholder"
      :loading="loading"
      filterable
      clearable
      :collapse-tags="multiple"
      :collapse-tags-tooltip="multiple"
      style="width: 100%"
      @update:model-value="handleChange"
    >
      <el-option
        v-for="session in sessions"
        :key="session.id"
        :label="session.name"
        :value="session.id"
      >
        <div class="session-option">
          <div class="session-info">
            <span class="session-name">{{ session.name }}</span>
            <el-tag v-if="session.type === 'group'" size="small" type="info">群聊</el-tag>
            <el-tag v-else size="small">单聊</el-tag>
          </div>
          <div class="session-meta">
            <span class="message-count">{{ session.messageCount || 0 }} 条消息</span>
            <span v-if="session.lastTime" class="last-time">
              {{ formatTime(session.lastTime) }}
            </span>
          </div>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useSessionStore } from '@/stores/session'

interface Props {
  modelValue?: string | string[]
  multiple?: boolean
  placeholder?: string
  type?: 'all' | 'group' | 'private'
}

interface Emits {
  (e: 'update:modelValue', value: string | string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  multiple: false,
  placeholder: '请选择会话',
  type: 'all'
})

const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
const loading = ref(false)

// 过滤后的会话列表
const sessions = computed(() => {
  let list = sessionStore.sessions || []
  
  if (props.type === 'group') {
    list = list.filter(s => s.type === 'group')
  } else if (props.type === 'private') {
    list = list.filter(s => s.type === 'private')
  }
  
  return list
})

// 格式化时间
function formatTime(time: Date | string): string {
  const date = typeof time === 'string' ? new Date(time) : time
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

// 处理选择变化
function handleChange(value: string | string[]) {
  emit('update:modelValue', value)
}

// 加载会话列表
async function loadSessions() {
  loading.value = true
  try {
    // sessionStore 可能没有 loadSessions 方法
    // 如果 sessions 已经存在，就不需要再次加载
    if (typeof sessionStore.loadSessions === 'function') {
      await sessionStore.loadSessions()
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 只在会话列表为空时尝试加载
  if (sessions.value.length === 0 && typeof sessionStore.loadSessions === 'function') {
    loadSessions()
  }
})
</script>

<style scoped lang="scss">
.session-selector {
  .session-option {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
    
    .session-info {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .session-name {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .el-tag {
        flex-shrink: 0;
      }
    }
    
    .session-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      
      .message-count {
        &::before {
          content: '💬 ';
        }
      }
      
      .last-time {
        &::before {
          content: '🕐 ';
        }
      }
    }
  }
}
</style>