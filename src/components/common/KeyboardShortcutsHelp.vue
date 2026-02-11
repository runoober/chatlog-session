<script setup lang="ts">
import { computed } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'

interface Shortcut {
  keys: string
  description: string
  category: string
}

// 定义属性
interface Props {
  modelValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false
})

// 定义事件
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 对话框显示状态
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 检测操作系统
const isMac = computed(() => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
})

// 快捷键列表
const shortcuts = computed<Shortcut[]>(() => {
  const cmdOrCtrl = isMac.value ? '⌘' : 'Ctrl'

  return [
    // 导航类
    {
      category: '导航',
      keys: `${cmdOrCtrl} + /`,
      description: '打开搜索'
    },
    {
      category: '导航',
      keys: `${cmdOrCtrl} + ,`,
      description: '打开设置'
    },
    {
      category: '导航',
      keys: 'Esc',
      description: '返回上一页（移动端）'
    },

    // 聊天类
    {
      category: '聊天',
      keys: 'Enter',
      description: '发送消息'
    },
    {
      category: '聊天',
      keys: `${isMac.value ? '⌘' : 'Ctrl'} + Enter`,
      description: '换行'
    },

    // 通用操作
    {
      category: '通用',
      keys: `${cmdOrCtrl} + C`,
      description: '复制选中内容'
    },
    {
      category: '通用',
      keys: `${cmdOrCtrl} + V`,
      description: '粘贴'
    },
    {
      category: '通用',
      keys: `${cmdOrCtrl} + A`,
      description: '全选'
    },
    {
      category: '通用',
      keys: `${cmdOrCtrl} + F`,
      description: '页面内搜索'
    },
    {
      category: '通用',
      keys: '?',
      description: '显示快捷键帮助'
    }
  ]
})

// 按分类分组快捷键
const groupedShortcuts = computed(() => {
  const groups: Record<string, Shortcut[]> = {}

  shortcuts.value.forEach(shortcut => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = []
    }
    groups[shortcut.category].push(shortcut)
  })

  return groups
})

// 分类顺序
const categoryOrder = ['导航', '聊天', '通用']

// 打开帮助
const open = () => {
  visible.value = true
}

// 暴露方法给父组件
defineExpose({
  open
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="键盘快捷键"
    width="600px"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    class="shortcuts-help-dialog"
  >
    <!-- 提示信息 -->
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="shortcuts-help-alert"
    >
      <template #title>
        <span v-if="isMac">按 <kbd>⌘</kbd> + <kbd>?</kbd> 随时打开此帮助</span>
        <span v-else>按 <kbd>Ctrl</kbd> + <kbd>?</kbd> 随时打开此帮助</span>
      </template>
    </el-alert>

    <!-- 快捷键列表 -->
    <div class="shortcuts-list">
      <div
        v-for="category in categoryOrder"
        :key="category"
        class="shortcuts-category"
      >
        <h3 class="category-title">{{ category }}</h3>

        <div class="shortcuts-items">
          <div
            v-for="(shortcut, index) in groupedShortcuts[category]"
            :key="index"
            class="shortcut-item"
          >
            <div class="shortcut-keys">
              <kbd
                v-for="(key, keyIndex) in shortcut.keys.split(' + ')"
                :key="keyIndex"
                class="key"
              >
                {{ key }}
              </kbd>
            </div>

            <div class="shortcut-description">
              {{ shortcut.description }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部提示 -->
    <template #footer>
      <div class="shortcuts-footer">
        <el-icon :size="16" color="var(--el-color-info)">
          <QuestionFilled />
        </el-icon>
        <span class="footer-text">提示：大部分快捷键在输入框外使用</span>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.shortcuts-help-dialog {
  :deep(.el-dialog__body) {
    padding: 20px 20px 10px;
  }

  :deep(.el-dialog__footer) {
    padding: 10px 20px 20px;
  }
}

.shortcuts-help-alert {
  margin-bottom: 20px;

  :deep(.el-alert__content) {
    padding: 0;
  }

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: 3px;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  }
}

.shortcuts-list {
  max-height: 500px;
  overflow-y: auto;
}

.shortcuts-category {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.category-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.shortcuts-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 140px;

  .key {
    display: inline-block;
    padding: 3px 8px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-weight: 500;
  }
}

.shortcut-description {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: right;
}

.shortcuts-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .footer-text {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

// 暗色模式
.dark {
  .shortcuts-help-alert kbd,
  .shortcut-keys .key {
    background-color: var(--el-fill-color-dark);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
}

// 响应式
@media (max-width: 768px) {
  .shortcuts-help-dialog {
    :deep(.el-dialog) {
      width: 90% !important;
      margin: 0 auto;
    }
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .shortcut-keys {
    min-width: auto;
  }

  .shortcut-description {
    text-align: left;
  }
}
</style>
