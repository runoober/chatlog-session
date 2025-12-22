<template>
  <div class="context-preview">
    <!-- 头部信息 -->
    <div class="preview-header">
      <div class="header-info">
        <el-icon class="header-icon"><Document /></el-icon>
        <span class="header-title">上下文预览</span>
        <el-tag v-if="contextText" size="small" type="info">
          {{ estimatedTokens }} tokens
        </el-tag>
      </div>
      
      <div class="header-actions">
        <el-button
          size="small"
          :loading="isBuilding"
          @click="handleRebuild"
        >
          <el-icon><Refresh /></el-icon>
          重新构建
        </el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!contextText"
          @click="handleCopy"
        >
          <el-icon><CopyDocument /></el-icon>
          复制
        </el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="preview-stats">
      <div class="stat-item">
        <el-icon><Collection /></el-icon>
        <span class="stat-label">引用数量:</span>
        <span class="stat-value">{{ references.length }}</span>
      </div>
      <div class="stat-item">
        <el-icon><Memo /></el-icon>
        <span class="stat-label">Token 数:</span>
        <span class="stat-value" :class="{ 'over-limit': isOverLimit }">
          {{ estimatedTokens }} / {{ maxTokens }}
        </span>
      </div>
      <div class="stat-item">
        <el-icon><Operation /></el-icon>
        <span class="stat-label">构建策略:</span>
        <span class="stat-value">{{ strategyLabel }}</span>
      </div>
    </div>

    <!-- 引用详情 -->
    <div class="preview-references">
      <el-collapse v-model="activeCollapse">
        <el-collapse-item name="references" title="引用详情">
          <div class="reference-list">
            <div
              v-for="ref in references"
              :key="ref.id"
              class="reference-item"
            >
              <el-icon class="ref-icon">
                <component :is="getReferenceIcon(ref.type)" />
              </el-icon>
              <div class="ref-content">
                <div class="ref-label">{{ ref.label }}</div>
                <div v-if="getReferenceDetail(ref)" class="ref-detail">
                  {{ getReferenceDetail(ref) }}
                </div>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 上下文内容 -->
    <div class="preview-content">
      <div class="content-header">
        <span class="content-title">上下文内容</span>
        <div class="content-actions">
          <el-button-group size="small">
            <el-button
              :type="viewMode === 'formatted' ? 'primary' : 'default'"
              @click="viewMode = 'formatted'"
            >
              <el-icon><Reading /></el-icon>
              格式化
            </el-button>
            <el-button
              :type="viewMode === 'raw' ? 'primary' : 'default'"
              @click="viewMode = 'raw'"
            >
              <el-icon><Document /></el-icon>
              原始
            </el-button>
          </el-button-group>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="isBuilding" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在构建上下文...</span>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!contextText"
        description="暂无上下文内容"
        :image-size="80"
      />

      <!-- 格式化视图 -->
      <div v-else-if="viewMode === 'formatted'" class="formatted-view">
        <div
          v-for="(section, index) in formattedSections"
          :key="index"
          class="section"
        >
          <div v-if="section.title" class="section-title">
            {{ section.title }}
          </div>
          <div class="section-content">
            <div
              v-for="(line, lineIndex) in section.lines"
              :key="lineIndex"
              class="content-line"
              :class="{ 'is-message': isMessageLine(line) }"
            >
              {{ line }}
            </div>
          </div>
        </div>
      </div>

      <!-- 原始视图 -->
      <div v-else class="raw-view">
        <pre class="raw-content">{{ contextText }}</pre>
      </div>
    </div>

    <!-- Token 使用率 -->
    <div v-if="contextText" class="token-usage">
      <div class="usage-label">Token 使用率</div>
      <el-progress
        :percentage="tokenUsageRate"
        :color="getProgressColor(tokenUsageRate)"
        :stroke-width="12"
      />
      <div v-if="isOverLimit" class="usage-warning">
        <el-icon><WarningFilled /></el-icon>
        <span>超出 Token 限制，部分内容可能被截断</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document,
  Refresh,
  CopyDocument,
  Collection,
  Memo,
  Operation,
  ChatDotRound,
  User,
  ChatLineRound,
  Clock,
  Reading,
  Loading,
  WarningFilled
} from '@element-plus/icons-vue'
import type { Reference, ContextBuildStrategy, SessionReference, MessageReference, UserReference, TimeRangeReference } from '@/types/ai'

// ==================== Props & Emits ====================

interface Props {
  /** 引用列表 */
  references: Reference[]
  /** 构建策略 */
  strategy: ContextBuildStrategy
  /** 最大 Token 数 */
  maxTokens: number
}

const props = defineProps<Props>()

interface Emits {
  (e: 'rebuild'): void
  (e: 'copy', text: string): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const contextText = ref('')
const estimatedTokens = ref(0)
const isBuilding = ref(false)
const viewMode = ref<'formatted' | 'raw'>('formatted')
const activeCollapse = ref(['references'])

// ==================== Computed ====================

const strategyLabel = computed(() => {
  const labels: Record<ContextBuildStrategy, string> = {
    smart: '智能采样',
    recent: '最近优先',
    random: '随机采样',
    hierarchical: '分层摘要'
  }
  return labels[props.strategy] || '未知'
})

const tokenUsageRate = computed(() => {
  if (props.maxTokens === 0) return 0
  return Math.min(100, (estimatedTokens.value / props.maxTokens) * 100)
})

const isOverLimit = computed(() => {
  return estimatedTokens.value > props.maxTokens
})

const formattedSections = computed(() => {
  if (!contextText.value) return []

  const sections: Array<{ title: string; lines: string[] }> = []
  const lines = contextText.value.split('\n')
  let currentSection: { title: string; lines: string[] } | null = null

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // 新的章节
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        title: line.substring(2).trim(),
        lines: []
      }
    } else if (currentSection) {
      if (line.trim()) {
        currentSection.lines.push(line)
      }
    } else {
      // 没有章节标题的内容
      if (!currentSection) {
        currentSection = { title: '', lines: [] }
      }
      if (line.trim()) {
        currentSection.lines.push(line)
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
})

// ==================== Methods ====================

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
  return iconMap[type] || Document
}

/**
 * 获取引用详情
 */
function getReferenceDetail(ref: Reference): string {
  switch (ref.type) {
    case 'session': {
      const sessionRef = ref as SessionReference
      return sessionRef.messageCount ? `${sessionRef.messageCount} 条消息` : ''
    }
    case 'message': {
      const messageRef = ref as MessageReference
      return messageRef.preview || `${messageRef.messageIds.length} 条消息`
    }
    case 'user': {
      const userRef = ref as UserReference
      return `ID: ${userRef.wxid}`
    }
    case 'timeRange': {
      const timeRangeRef = ref as TimeRangeReference
      return `${formatDate(timeRangeRef.range.start)} ~ ${formatDate(timeRangeRef.range.end)}`
    }
    default:
      return ''
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 判断是否为消息行
 */
function isMessageLine(line: string): boolean {
  return /^\[.*?\].*?:/.test(line)
}

/**
 * 估算 Token 数
 */
function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return Math.ceil(chineseChars * 1.5 + englishWords)
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
 * 构建上下文
 */
async function buildContext() {
  if (props.references.length === 0) {
    contextText.value = ''
    estimatedTokens.value = 0
    return
  }

  isBuilding.value = true

  try {
    // 模拟构建上下文（实际应调用 store 方法）
    await new Promise(resolve => setTimeout(resolve, 500))

    const parts: string[] = []

    // 添加引用信息
    const sessionRefs = props.references.filter(r => r.type === 'session')
    if (sessionRefs.length > 0) {
      parts.push('# 会话范围')
      sessionRefs.forEach(ref => {
        const sessionRef = ref as SessionReference
        parts.push(`- ${sessionRef.sessionName}`)
      })
      parts.push('')
    }

    const timeRangeRefs = props.references.filter(r => r.type === 'timeRange')
    if (timeRangeRefs.length > 0) {
      parts.push('# 时间范围')
      timeRangeRefs.forEach(ref => {
        const timeRangeRef = ref as TimeRangeReference
        parts.push(`${timeRangeRef.range.start} ~ ${timeRangeRef.range.end}`)
      })
      parts.push('')
    }

    const userRefs = props.references.filter(r => r.type === 'user')
    if (userRefs.length > 0) {
      parts.push('# 相关用户')
      userRefs.forEach(ref => {
        const userRef = ref as UserReference
        parts.push(`- ${userRef.displayName} (${userRef.wxid})`)
      })
      parts.push('')
    }

    // 添加示例消息（实际应从数据库查询）
    parts.push('# 聊天记录')
    parts.push('[2024-01-15 10:30:25] 张三 (工作群): 大家早上好！')
    parts.push('[2024-01-15 10:31:12] 李四 (工作群): 早上好！今天的任务安排是什么？')
    parts.push('[2024-01-15 10:32:45] 王五 (工作群): 我们先开个会讨论一下')
    parts.push('')
    parts.push('注意: 这是预览内容，实际使用时会根据引用和策略加载真实消息')

    const text = parts.join('\n')
    contextText.value = text
    estimatedTokens.value = estimateTokenCount(text)
  } catch (error) {
    console.error('构建上下文失败:', error)
    ElMessage.error('构建上下文失败')
  } finally {
    isBuilding.value = false
  }
}

/**
 * 重新构建
 */
function handleRebuild() {
  buildContext()
  emit('rebuild')
}

/**
 * 复制内容
 */
async function handleCopy() {
  if (!contextText.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  try {
    await navigator.clipboard.writeText(contextText.value)
    ElMessage.success('已复制到剪贴板')
    emit('copy', contextText.value)
  } catch (error) {
    console.error('复制失败:', error)
    ElMessage.error('复制失败')
  }
}

// ==================== Lifecycle ====================

onMounted(() => {
  buildContext()
})

// ==================== Watch ====================

watch(
  () => [props.references, props.strategy, props.maxTokens],
  () => {
    buildContext()
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
.context-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 600px;
  overflow: hidden;
}

// 头部
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);

  .header-info {
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

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

// 统计信息
.preview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;

    .el-icon {
      font-size: 18px;
      color: var(--el-color-primary);
    }

    .stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);

      &.over-limit {
        color: var(--el-color-danger);
      }
    }
  }
}

// 引用详情
.preview-references {
  .reference-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reference-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;

    .ref-icon {
      margin-top: 2px;
      font-size: 16px;
      color: var(--el-color-primary);
    }

    .ref-content {
      flex: 1;

      .ref-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .ref-detail {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

// 内容区域
.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .content-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--el-text-color-secondary);

    .el-icon {
      font-size: 24px;
    }
  }

  .formatted-view,
  .raw-view {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
  }

  .formatted-view {
    .section {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-title {
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid var(--el-color-primary);
        font-size: 15px;
        font-weight: 600;
        color: var(--el-color-primary);
      }

      .section-content {
        .content-line {
          padding: 4px 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--el-text-color-regular);

          &.is-message {
            padding: 6px 12px;
            margin: 4px 0;
            background: var(--el-bg-color);
            border-left: 3px solid var(--el-color-primary);
            border-radius: 4px;
          }
        }
      }
    }
  }

  .raw-view {
    .raw-content {
      margin: 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}

// Token 使用率
.token-usage {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;

  .usage-label {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .usage-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--el-color-danger-light-9);
    border-radius: 4px;
    font-size: 12px;
    color: var(--el-color-danger);

    .el-icon {
      font-size: 16px;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .context-preview {
    max-height: none;
  }

  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }

  .preview-stats {
    grid-template-columns: 1fr;
  }
}
</style>