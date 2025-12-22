<template>
  <div class="message-selector">
    <div class="selector-header">
      <el-button
        size="small"
        type="primary"
        @click="openDialog"
      >
        <el-icon><ChatDotRound /></el-icon>
        {{ selectedMessages.length > 0 ? `已选择 ${selectedMessages.length} 条消息` : '选择消息' }}
      </el-button>
      <el-button
        v-if="selectedMessages.length > 0"
        size="small"
        @click="handleClear"
      >
        清空
      </el-button>
    </div>

    <!-- 已选消息预览 -->
    <div v-if="selectedMessages.length > 0" class="selected-preview">
      <div
        v-for="msg in previewMessages"
        :key="msg.id"
        class="message-item"
      >
        <div class="message-header">
          <span class="sender">{{ msg.senderName || msg.sender }}</span>
          <span class="time">{{ formatTime(msg.time) }}</span>
        </div>
        <div class="message-content">{{ truncateContent(msg.content) }}</div>
      </div>
      <div v-if="selectedMessages.length > 3" class="more-indicator">
        还有 {{ selectedMessages.length - 3 }} 条消息...
      </div>
    </div>

    <!-- 选择对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="选择消息"
      width="70%"
      :close-on-click-modal="false"
    >
      <div class="message-selector-dialog">
        <!-- 提示信息 -->
        <el-alert
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>
            请在聊天记录页面选择需要的消息后，使用"添加到 AI 对话"功能
          </template>
        </el-alert>

        <!-- 手动输入消息ID -->
        <div class="manual-input">
          <el-input
            v-model="manualInput"
            type="textarea"
            :rows="4"
            placeholder="或者在此输入消息内容（每行一条消息）"
          />
          <el-button
            type="primary"
            @click="handleAddManualMessages"
            style="margin-top: 8px"
          >
            添加消息
          </el-button>
        </div>

        <!-- 已选消息列表 -->
        <div v-if="tempSelectedMessages.length > 0" class="selected-messages">
          <div class="list-header">
            <span>已选择 {{ tempSelectedMessages.length }} 条消息</span>
            <el-button
              size="small"
              type="danger"
              link
              @click="tempSelectedMessages = []"
            >
              清空
            </el-button>
          </div>
          <div class="message-list">
            <div
              v-for="(msg, index) in tempSelectedMessages"
              :key="index"
              class="message-row"
            >
              <div class="message-detail">
                <div class="message-meta">
                  <span class="sender">{{ msg.senderName || msg.sender }}</span>
                  <span class="time">{{ formatFullTime(msg.time) }}</span>
                </div>
                <div class="message-text">{{ msg.content }}</div>
              </div>
              <el-button
                type="danger"
                link
                @click="removeMessage(index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <span class="selected-count">
            已选择 {{ tempSelectedMessages.length }} 条消息
          </span>
          <div class="actions">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleConfirm">
              确定
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Delete } from '@element-plus/icons-vue'
import type { Message } from '@/types/message'

interface Props {
  modelValue?: Message[]
  placeholder?: string
  maxSelection?: number
}

interface Emits {
  (e: 'update:modelValue', value: Message[]): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  placeholder: '请选择消息',
  maxSelection: 0 // 0 表示不限制
})

const emit = defineEmits<Emits>()

// 对话框状态
const dialogVisible = ref(false)

// 手动输入
const manualInput = ref('')

// 临时选中的消息
const tempSelectedMessages = ref<Message[]>([])

// 已选消息对象
const selectedMessages = ref<Message[]>([...props.modelValue])

// 预览消息（前3条）
const previewMessages = computed(() => selectedMessages.value.slice(0, 3))

// 格式化时间（简短）
function formatTime(time: string): string {
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 格式化时间（完整）
function formatFullTime(time: string): string {
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

// 截断内容
function truncateContent(content: string, maxLength = 50): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}

// 打开选择对话框
function openDialog() {
  dialogVisible.value = true
  tempSelectedMessages.value = [...selectedMessages.value]
  manualInput.value = ''
}

// 添加手动输入的消息
function handleAddManualMessages() {
  if (!manualInput.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }

  const lines = manualInput.value.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    ElMessage.warning('没有有效的消息内容')
    return
  }

  const now = new Date()
  const newMessages: Message[] = lines.map((content, index) => ({
    id: Date.now() + index,
    seq: 0,
    time: now.toISOString(),
    createTime: now.getTime(),
    talker: 'manual',
    talkerName: '手动输入',
    sender: 'manual',
    senderName: '手动输入',
    isSelf: false,
    isSend: 0,
    isChatRoom: false,
    type: 1, // Text
    subType: 0,
    content: content.trim()
  }))

  tempSelectedMessages.value.push(...newMessages)
  manualInput.value = ''
  ElMessage.success(`已添加 ${newMessages.length} 条消息`)
}

// 移除消息
function removeMessage(index: number) {
  tempSelectedMessages.value.splice(index, 1)
}

// 确认选择
function handleConfirm() {
  // 检查数量限制
  if (props.maxSelection > 0 && tempSelectedMessages.value.length > props.maxSelection) {
    ElMessage.warning(`最多只能选择 ${props.maxSelection} 条消息`)
    return
  }

  selectedMessages.value = [...tempSelectedMessages.value]
  emit('update:modelValue', selectedMessages.value)
  dialogVisible.value = false
  ElMessage.success(`已选择 ${selectedMessages.value.length} 条消息`)
}

// 清空选择
function handleClear() {
  selectedMessages.value = []
  emit('update:modelValue', [])
}
</script>

<style scoped lang="scss">
.message-selector {
  .selector-header {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .selected-preview {
    padding: 12px;
    background-color: var(--el-fill-color-light);
    border-radius: 6px;
    border: 1px solid var(--el-border-color);

    .message-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--el-border-color-lighter);

      &:last-child {
        border-bottom: none;
      }

      .message-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;

        .sender {
          font-size: 13px;
          font-weight: 500;
          color: var(--el-text-color-primary);
        }

        .time {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }

      .message-content {
        font-size: 13px;
        color: var(--el-text-color-regular);
        line-height: 1.5;
      }
    }

    .more-indicator {
      margin-top: 8px;
      text-align: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.message-selector-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .manual-input {
    display: flex;
    flex-direction: column;
  }

  .selected-messages {
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--el-border-color);

      span {
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
      }
    }

    .message-list {
      max-height: 400px;
      overflow-y: auto;

      .message-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 12px;
        border-bottom: 1px solid var(--el-border-color-lighter);
        transition: background-color 0.2s;

        &:hover {
          background-color: var(--el-fill-color-light);
        }

        .message-detail {
          flex: 1;

          .message-meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;

            .sender {
              font-size: 13px;
              font-weight: 500;
              color: var(--el-text-color-primary);
            }

            .time {
              font-size: 12px;
              color: var(--el-text-color-secondary);
            }
          }

          .message-text {
            font-size: 13px;
            color: var(--el-text-color-regular);
            line-height: 1.6;
            word-wrap: break-word;
          }
        }
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .selected-count {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .actions {
    display: flex;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .message-selector-dialog {
    .manual-input {
      textarea {
        font-size: 13px;
      }
    }
  }
}
</style>