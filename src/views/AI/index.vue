<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AIConversationPanel from '@/components/ai/AIConversationPanel.vue'
import { useAIConversationStore } from '@/stores/ai/conversation'
import { useLLMConfigStore } from '@/stores/ai/llm-config'
import { useAppStore } from '@/stores/app'

const conversationStore = useAIConversationStore()
const llmConfigStore = useLLMConfigStore()
const appStore = useAppStore()

// 当前对话 ID
const currentConversationId = ref<number | null>(null)

// 计算属性：是否已配置 LLM
const isLLMConfigured = computed(() => {
  return llmConfigStore.isConfigured
})



// 初始化
onMounted(async () => {
  // 初始化 LLM 配置
  await llmConfigStore.init()
  
  // 检查 LLM 配置
  if (!isLLMConfigured.value) {
    ElMessage.warning('请先在设置中配置 AI 模型')
    return
  }

  // 加载对话历史
  await conversationStore.loadConversations()

  // 如果没有对话，创建一个新对话
  if (conversationStore.conversations.length === 0) {
    handleNewConversation()
  } else {
    // 选择最近的对话
    currentConversationId.value = conversationStore.conversations[0].id
  }
})

// 创建新对话
const handleNewConversation = async () => {
  try {
    const conversationId = await conversationStore.createConversation('新对话')
    currentConversationId.value = conversationId
    ElMessage.success('已创建新对话')
  } catch (error) {
    console.error('创建对话失败:', error)
    ElMessage.error('创建对话失败')
  }
}

// 选择对话
const handleSelectConversation = (id: number) => {
  currentConversationId.value = id
}

// 响应式判断
const isMobile = computed(() => appStore.isMobile)
</script>

<template>
  <div class="ai-assistant-page">
    <!-- 主内容区 -->
    <div class="ai-assistant-content">
      <!-- 未配置提示 -->
      <div v-if="!isLLMConfigured" class="config-prompt">
        <el-empty description="请先在设置中配置 AI 模型">
          <template #extra>
            <p style="color: var(--el-text-color-secondary); font-size: 14px; margin-top: 8px;">
              在左侧导航栏点击"设置"，然后配置 AI 模型
            </p>
          </template>
        </el-empty>
      </div>

      <!-- 对话界面 -->
      <div v-else class="conversation-container">
        <!-- 桌面端：侧边栏 + 对话面板 -->
        <template v-if="!isMobile">
          <div class="conversation-sidebar">
            <div class="sidebar-header">
              <h3>对话列表</h3>
              <el-button
                type="primary"
                size="small"
                @click="handleNewConversation"
              >
                新对话
              </el-button>
            </div>

            <div class="conversation-list">
              <div
                v-for="conv in conversationStore.conversations"
                :key="conv.id"
                class="conversation-item"
                :class="{ active: currentConversationId === conv.id }"
                @click="handleSelectConversation(conv.id)"
              >
                <div class="conversation-info">
                  <div class="conversation-title">{{ conv.title }}</div>
                  <div class="conversation-meta">
                    <span class="message-count">{{ conv.messages?.length || 0 }} 条消息</span>
                    <span class="update-time">{{ new Date(conv.updatedAt).toLocaleDateString() }}</span>
                  </div>
                </div>
              </div>

              <el-empty
                v-if="conversationStore.conversations.length === 0"
                description="暂无对话"
                :image-size="100"
              />
            </div>
          </div>

          <div class="conversation-main">
            <AIConversationPanel
              v-if="currentConversationId"
              :key="currentConversationId"
              :conversation-id="currentConversationId"
            />
            <el-empty
              v-else
              description="请选择或创建一个对话"
              :image-size="120"
            >
              <el-button type="primary" @click="handleNewConversation">
                创建新对话
              </el-button>
            </el-empty>
          </div>
        </template>

        <!-- 移动端：全屏对话面板 -->
        <template v-else>
          <AIConversationPanel
            v-if="currentConversationId"
            :key="currentConversationId"
            :conversation-id="currentConversationId"
          />
          <div v-else class="mobile-empty">
            <el-empty description="请创建一个对话">
              <el-button type="primary" @click="handleNewConversation">
                创建新对话
              </el-button>
            </el-empty>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-assistant-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--el-bg-color);
}

// 主内容区
.ai-assistant-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// 配置提示
.config-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

// 对话容器
.conversation-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 桌面端侧边栏
.conversation-sidebar {
  width: 280px;
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);

  @media (max-width: 768px) {
    display: none;
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .conversation-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .conversation-item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 4px;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.active {
      background: var(--el-color-primary-light-9);
      border-left: 3px solid var(--el-color-primary);
    }

    .conversation-info {
      .conversation-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .conversation-meta {
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

        .update-time {
          &::before {
            content: '🕒 ';
          }
        }
      }
    }
  }
}

// 桌面端主面板
.conversation-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// 移动端空状态
.mobile-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  @media (min-width: 769px) {
    display: none;
  }
}

// 暗色模式
.dark {
  .conversation-sidebar {
    background: var(--el-bg-color);
  }
}
</style>