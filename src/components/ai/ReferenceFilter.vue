<template>
  <div class="reference-filter">
    <!-- 头部 -->
    <div class="filter-header">
      <el-icon class="header-icon"><Filter /></el-icon>
      <span class="header-title">过滤器</span>
      <el-button
        v-if="hasActiveFilters"
        size="small"
        text
        type="danger"
        @click="handleClearAll"
      >
        清除全部
      </el-button>
    </div>

    <!-- 过滤选项 -->
    <div class="filter-options">
      <!-- 关键词过滤 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><Key /></el-icon>
          <span>关键词</span>
        </div>
        <div class="keyword-input">
          <el-input
            v-model="keywordInput"
            placeholder="输入关键词，按回车添加"
            clearable
            @keyup.enter="handleAddKeyword"
          >
            <template #append>
              <el-button :icon="Plus" @click="handleAddKeyword" />
            </template>
          </el-input>
        </div>
        <div v-if="keywords.length > 0" class="keyword-tags">
          <el-tag
            v-for="(keyword, index) in keywords"
            :key="index"
            closable
            @close="handleRemoveKeyword(index)"
          >
            {{ keyword }}
          </el-tag>
        </div>
      </div>

      <!-- 发送者过滤 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><User /></el-icon>
          <span>发送者</span>
        </div>
        <el-select
          v-model="selectedSenders"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择发送者"
          clearable
          filterable
          @change="handleFilterChange"
        >
          <el-option
            v-for="sender in senderOptions"
            :key="sender.value"
            :label="sender.label"
            :value="sender.value"
          >
            <div class="sender-option">
              <el-avatar :size="24" :src="sender.avatar">
                {{ sender.label.charAt(0) }}
              </el-avatar>
              <span>{{ sender.label }}</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- 消息类型过滤 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><ChatLineRound /></el-icon>
          <span>消息类型</span>
        </div>
        <el-checkbox-group
          v-model="selectedMessageTypes"
          @change="handleFilterChange"
        >
          <el-checkbox
            v-for="type in messageTypeOptions"
            :key="type.value"
            :label="type.value"
          >
            <el-icon><component :is="type.icon" /></el-icon>
            {{ type.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>

      <!-- 时间段过滤 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><Clock /></el-icon>
          <span>时间段</span>
        </div>
        <el-select
          v-model="selectedTimePeriod"
          placeholder="选择时间段"
          clearable
          @change="handleFilterChange"
        >
          <el-option
            v-for="period in timePeriodOptions"
            :key="period.value"
            :label="period.label"
            :value="period.value"
          />
        </el-select>
        <div v-if="selectedTimePeriod === 'custom'" class="custom-time">
          <el-time-picker
            v-model="customTimeRange"
            is-range
            range-separator="-"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="HH:mm"
            @change="handleFilterChange"
          />
        </div>
      </div>

      <!-- 消息长度过滤 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><Histogram /></el-icon>
          <span>消息长度</span>
        </div>
        <div class="length-filter">
          <el-slider
            v-model="messageLengthRange"
            range
            :min="0"
            :max="1000"
            :step="10"
            show-stops
            @change="handleFilterChange"
          />
          <div class="length-display">
            <span>{{ messageLengthRange[0] }}</span>
            <span>-</span>
            <span>{{ messageLengthRange[1] }} 字</span>
          </div>
        </div>
      </div>

      <!-- 包含附件 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><Paperclip /></el-icon>
          <span>附件类型</span>
        </div>
        <el-checkbox-group
          v-model="selectedAttachmentTypes"
          @change="handleFilterChange"
        >
          <el-checkbox
            v-for="type in attachmentTypeOptions"
            :key="type.value"
            :label="type.value"
          >
            <el-icon><component :is="type.icon" /></el-icon>
            {{ type.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>

      <!-- 排序选项 -->
      <div class="filter-section">
        <div class="section-label">
          <el-icon><Sort /></el-icon>
          <span>排序方式</span>
        </div>
        <el-radio-group
          v-model="sortOrder"
          @change="handleFilterChange"
        >
          <el-radio-button value="time-asc">
            <el-icon><Bottom /></el-icon>
            时间升序
          </el-radio-button>
          <el-radio-button value="time-desc">
            <el-icon><Top /></el-icon>
            时间降序
          </el-radio-button>
          <el-radio-button value="length-desc">
            <el-icon><DataLine /></el-icon>
            长度降序
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 高级选项 -->
      <div class="filter-section">
        <el-collapse>
          <el-collapse-item title="高级选项" name="advanced">
            <div class="advanced-options">
              <el-checkbox
                v-model="excludeSystemMessages"
                @change="handleFilterChange"
              >
                排除系统消息
              </el-checkbox>
              <el-checkbox
                v-model="onlyImportant"
                @change="handleFilterChange"
              >
                仅显示重要消息
              </el-checkbox>
              <el-checkbox
                v-model="deduplication"
                @change="handleFilterChange"
              >
                去重相似消息
              </el-checkbox>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- 过滤结果统计 -->
    <div v-if="hasActiveFilters" class="filter-summary">
      <el-icon><InfoFilled /></el-icon>
      <span>{{ filterSummary }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Filter,
  Key,
  User,
  ChatLineRound,
  Clock,
  Histogram,
  Paperclip,
  Sort,
  InfoFilled,
  Plus,
  Bottom,
  Top,
  DataLine,
  ChatDotSquare,
  Picture,
  VideoCamera,
  Microphone,
  Document,
  Link as LinkIcon,
  Location
} from '@element-plus/icons-vue'

// ==================== Props & Emits ====================

interface FilterConfig {
  keywords?: string[]
  senders?: string[]
  messageTypes?: string[]
  timePeriod?: string
  customTimeRange?: [Date, Date] | null
  messageLengthRange?: [number, number]
  attachmentTypes?: string[]
  sortOrder?: string
  excludeSystemMessages?: boolean
  onlyImportant?: boolean
  deduplication?: boolean
}

interface Props {
  modelValue?: FilterConfig
  /** 发送者选项 */
  senderOptions?: Array<{ label: string; value: string; avatar?: string }>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  senderOptions: () => []
})

interface Emits {
  (e: 'update:modelValue', value: FilterConfig): void
  (e: 'change', value: FilterConfig): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const keywordInput = ref('')
const keywords = ref<string[]>(props.modelValue.keywords || [])
const selectedSenders = ref<string[]>(props.modelValue.senders || [])
const selectedMessageTypes = ref<string[]>(props.modelValue.messageTypes || [])
const selectedTimePeriod = ref<string>(props.modelValue.timePeriod || '')
const customTimeRange = ref<[Date, Date] | null>(props.modelValue.customTimeRange || null)
const messageLengthRange = ref<[number, number]>(props.modelValue.messageLengthRange || [0, 1000])
const selectedAttachmentTypes = ref<string[]>(props.modelValue.attachmentTypes || [])
const sortOrder = ref<string>(props.modelValue.sortOrder || 'time-desc')
const excludeSystemMessages = ref(props.modelValue.excludeSystemMessages || false)
const onlyImportant = ref(props.modelValue.onlyImportant || false)
const deduplication = ref(props.modelValue.deduplication || false)

// ==================== Options ====================

const messageTypeOptions = [
  { label: '文本', value: 'text', icon: ChatDotSquare },
  { label: '图片', value: 'image', icon: Picture },
  { label: '视频', value: 'video', icon: VideoCamera },
  { label: '语音', value: 'voice', icon: Microphone },
  { label: '文件', value: 'file', icon: Document },
  { label: '链接', value: 'link', icon: LinkIcon },
  { label: '位置', value: 'location', icon: Location }
]

const timePeriodOptions = [
  { label: '全天', value: 'all' },
  { label: '上午 (0-12)', value: 'morning' },
  { label: '下午 (12-18)', value: 'afternoon' },
  { label: '晚上 (18-24)', value: 'evening' },
  { label: '工作时间 (9-18)', value: 'work' },
  { label: '自定义', value: 'custom' }
]

const attachmentTypeOptions = [
  { label: '图片', value: 'image', icon: Picture },
  { label: '视频', value: 'video', icon: VideoCamera },
  { label: '语音', value: 'voice', icon: Microphone },
  { label: '文件', value: 'file', icon: Document }
]

// ==================== Computed ====================

const hasActiveFilters = computed(() => {
  return (
    keywords.value.length > 0 ||
    selectedSenders.value.length > 0 ||
    selectedMessageTypes.value.length > 0 ||
    selectedTimePeriod.value !== '' ||
    selectedAttachmentTypes.value.length > 0 ||
    excludeSystemMessages.value ||
    onlyImportant.value ||
    deduplication.value
  )
})

const filterSummary = computed(() => {
  const parts: string[] = []
  
  if (keywords.value.length > 0) {
    parts.push(`关键词: ${keywords.value.length} 个`)
  }
  
  if (selectedSenders.value.length > 0) {
    parts.push(`发送者: ${selectedSenders.value.length} 个`)
  }
  
  if (selectedMessageTypes.value.length > 0) {
    parts.push(`消息类型: ${selectedMessageTypes.value.length} 个`)
  }
  
  if (selectedTimePeriod.value) {
    const period = timePeriodOptions.find(p => p.value === selectedTimePeriod.value)
    parts.push(`时间段: ${period?.label || '自定义'}`)
  }
  
  if (selectedAttachmentTypes.value.length > 0) {
    parts.push(`附件: ${selectedAttachmentTypes.value.length} 种`)
  }
  
  return parts.join(', ') || '无活动过滤器'
})

// ==================== Methods ====================

/**
 * 添加关键词
 */
function handleAddKeyword() {
  const keyword = keywordInput.value.trim()
  if (!keyword) {
    return
  }
  
  if (keywords.value.includes(keyword)) {
    ElMessage.warning('关键词已存在')
    return
  }
  
  keywords.value.push(keyword)
  keywordInput.value = ''
  handleFilterChange()
}

/**
 * 移除关键词
 */
function handleRemoveKeyword(index: number) {
  keywords.value.splice(index, 1)
  handleFilterChange()
}

/**
 * 清除所有过滤器
 */
function handleClearAll() {
  keywords.value = []
  selectedSenders.value = []
  selectedMessageTypes.value = []
  selectedTimePeriod.value = ''
  customTimeRange.value = null
  messageLengthRange.value = [0, 1000]
  selectedAttachmentTypes.value = []
  sortOrder.value = 'time-desc'
  excludeSystemMessages.value = false
  onlyImportant.value = false
  deduplication.value = false
  
  handleFilterChange()
  ElMessage.info('已清除所有过滤器')
}

/**
 * 处理过滤器变化
 */
function handleFilterChange() {
  const config: FilterConfig = {
    keywords: keywords.value,
    senders: selectedSenders.value,
    messageTypes: selectedMessageTypes.value,
    timePeriod: selectedTimePeriod.value,
    customTimeRange: customTimeRange.value,
    messageLengthRange: messageLengthRange.value,
    attachmentTypes: selectedAttachmentTypes.value,
    sortOrder: sortOrder.value,
    excludeSystemMessages: excludeSystemMessages.value,
    onlyImportant: onlyImportant.value,
    deduplication: deduplication.value
  }
  
  emit('update:modelValue', config)
  emit('change', config)
}
</script>

<style scoped lang="scss">
.reference-filter {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

// 头部
.filter-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);

  .header-icon {
    font-size: 20px;
    color: var(--el-color-primary);
  }

  .header-title {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

// 过滤选项
.filter-options {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-section {
  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);

    .el-icon {
      color: var(--el-color-primary);
    }
  }

  .keyword-input {
    margin-bottom: 12px;
  }

  .keyword-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .sender-option {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .el-select,
  .el-checkbox-group,
  .el-radio-group {
    width: 100%;
  }

  .el-checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-checkbox {
      margin: 0;

      :deep(.el-checkbox__label) {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
  }

  .custom-time {
    margin-top: 12px;

    .el-time-picker {
      width: 100%;
    }
  }

  .length-filter {
    .length-display {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .advanced-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 0;
  }
}

// 过滤结果统计
.filter-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-color-primary);

  .el-icon {
    font-size: 16px;
  }
}

// 响应式
@media (max-width: 768px) {
  .reference-filter {
    padding: 16px;
  }

  .filter-section {
    .el-radio-group {
      :deep(.el-radio-button) {
        flex: 1;
        
        .el-radio-button__inner {
          width: 100%;
          padding: 8px 12px;
        }
      }
    }
  }
}
</style>