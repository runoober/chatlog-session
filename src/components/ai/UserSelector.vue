<template>
  <div class="user-selector">
    <el-select
      :model-value="modelValue"
      :placeholder="placeholder"
      :loading="loading"
      filterable
      clearable
      style="width: 100%"
      @update:model-value="handleChange"
    >
      <el-option
        v-for="user in users"
        :key="user.wxid"
        :label="user.nickname || user.remark"
        :value="user.wxid"
      >
        <div class="user-option">
          <el-avatar :size="32" :src="user.avatar">
            {{ (user.nickname || user.remark)?.charAt(0) || '?' }}
          </el-avatar>
          <div class="user-info">
            <span class="user-name">{{ user.nickname || user.remark }}</span>
            <span v-if="user.remark && user.nickname !== user.remark" class="user-remark">（{{ user.remark }}）</span>
            <span v-if="user.wxid" class="user-id">{{ user.wxid }}</span>
          </div>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useContactStore } from '@/stores/contact'

interface Props {
  modelValue?: string
  placeholder?: string
  filterType?: 'all' | 'friend' | 'group-member'
  sessionId?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请选择用户',
  filterType: 'all'
})

const emit = defineEmits<Emits>()

const contactStore = useContactStore()
const loading = ref(false)

// 用户列表
const users = computed(() => {
  let list = contactStore.contacts || []
  
  // 根据类型过滤
  if (props.filterType === 'friend') {
    list = list.filter(c => c.type === 'friend')
  } else if (props.filterType === 'group-member' && props.sessionId) {
    // 如果需要群成员，从群聊信息中获取
    // 这里简化处理，实际可能需要单独的群成员API
    list = list.filter(c => c.type === 'friend')
  }
  
  // 排序：优先显示有备注的、最近联系的
  return list.sort((a, b) => {
    // 有备注的排前面
    if (a.remark && !b.remark) return -1
    if (!a.remark && b.remark) return 1
    
    // 按昵称排序
    return (a.nickname || '').localeCompare(b.nickname || '')
  })
})

// 处理选择变化
function handleChange(value: string) {
  emit('update:modelValue', value)
}

// 加载联系人列表
async function loadContacts() {
  loading.value = true
  try {
    // contactStore 可能没有 loadContacts 方法
    if (typeof contactStore.loadContacts === 'function') {
      await contactStore.loadContacts()
    }
  } catch (error) {
    console.error('加载联系人列表失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 只在联系人列表为空时尝试加载
  if (users.value.length === 0 && typeof contactStore.loadContacts === 'function') {
    loadContacts()
  }
})
</script>

<style scoped lang="scss">
.user-selector {
  .user-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    
    .user-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      
      .user-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        
        .user-remark {
          color: var(--el-text-color-secondary);
          font-weight: 400;
        }
      }
      
      .user-id {
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

:deep(.el-select-dropdown__item) {
  height: auto;
  padding: 8px 12px;
}
</style>