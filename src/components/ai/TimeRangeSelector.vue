<template>
  <div class="time-range-selector">
    <div class="selector-header">
      <el-icon class="header-icon"><Calendar /></el-icon>
      <span class="header-title">选择时间范围</span>
    </div>

    <!-- 快捷选择按钮 -->
    <div class="quick-select-section">
      <div class="section-label">快捷选择</div>
      <div class="quick-buttons">
        <el-button
          v-for="preset in quickPresets"
          :key="preset.value"
          size="small"
          :type="isPresetActive(preset.value) ? 'primary' : 'default'"
          @click="handleQuickSelect(preset.value)"
        >
          <el-icon><component :is="preset.icon" /></el-icon>
          {{ preset.label }}
        </el-button>
      </div>
    </div>

    <el-divider />

    <!-- 自定义时间范围 -->
    <div class="custom-range-section">
      <div class="section-label">自定义范围</div>
      
      <div class="date-inputs">
        <div class="date-input-item">
          <label>开始时间</label>
          <el-date-picker
            v-model="startDate"
            type="datetime"
            placeholder="选择开始时间"
            :disabled-date="disabledStartDate"
            :shortcuts="dateShortcuts"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            @change="handleDateChange"
          />
        </div>

        <div class="range-separator">
          <el-icon><Right /></el-icon>
        </div>

        <div class="date-input-item">
          <label>结束时间</label>
          <el-date-picker
            v-model="endDate"
            type="datetime"
            placeholder="选择结束时间"
            :disabled-date="disabledEndDate"
            :shortcuts="dateShortcuts"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            @change="handleDateChange"
          />
        </div>
      </div>

      <!-- 时间范围预设 -->
      <div class="range-presets">
        <el-tag
          v-for="preset in customPresets"
          :key="preset.value"
          :type="isCustomPresetActive(preset.value) ? 'primary' : 'info'"
          class="preset-tag"
          @click="handleCustomPreset(preset.value)"
        >
          {{ preset.label }}
        </el-tag>
      </div>
    </div>

    <el-divider />

    <!-- 当前选择预览 -->
    <div v-if="currentRange" class="range-preview">
      <div class="preview-header">
        <el-icon><Clock /></el-icon>
        <span>当前选择</span>
      </div>
      
      <div class="preview-content">
        <div class="preview-item">
          <span class="label">开始:</span>
          <span class="value">{{ formatDateTime(currentRange.start) }}</span>
        </div>
        <div class="preview-item">
          <span class="label">结束:</span>
          <span class="value">{{ formatDateTime(currentRange.end) }}</span>
        </div>
        <div class="preview-item">
          <span class="label">时长:</span>
          <span class="value">{{ calculateDuration(currentRange.start, currentRange.end) }}</span>
        </div>
      </div>

      <div class="preview-actions">
        <el-button size="small" @click="handleClear">
          <el-icon><Delete /></el-icon>
          清除
        </el-button>
        <el-button size="small" type="primary" @click="handleConfirm">
          <el-icon><Check /></el-icon>
          确认
        </el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else
      description="请选择时间范围"
      :image-size="80"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calendar,
  Clock,
  Right,
  Delete,
  Check,
  Sunny,
  Moon,
  Timer
} from '@element-plus/icons-vue'

// ==================== Props & Emits ====================

interface Props {
  modelValue?: { start: string; end: string } | null
  /** 最大可选范围（天） */
  maxRange?: number
  /** 是否允许未来时间 */
  allowFuture?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  maxRange: 365,
  allowFuture: false
})

interface Emits {
  (e: 'update:modelValue', value: { start: string; end: string } | null): void
  (e: 'change', value: { start: string; end: string } | null): void
  (e: 'confirm'): void
}

const emit = defineEmits<Emits>()

// ==================== State ====================

const startDate = ref<string>('')
const endDate = ref<string>('')
const activePreset = ref<string>('')

// ==================== Computed ====================

const currentRange = computed(() => {
  if (startDate.value && endDate.value) {
    return {
      start: startDate.value,
      end: endDate.value
    }
  }
  return null
})

// 快捷预设
const quickPresets = [
  { label: '今天', value: 'today', icon: Sunny },
  { label: '昨天', value: 'yesterday', icon: Moon },
  { label: '本周', value: 'thisWeek', icon: Calendar },
  { label: '本月', value: 'thisMonth', icon: Calendar },
  { label: '最近 7 天', value: 'last7days', icon: Timer },
  { label: '最近 30 天', value: 'last30days', icon: Timer }
]

// 自定义预设
const customPresets = [
  { label: '全天', value: 'allDay' },
  { label: '上午 (8-12)', value: 'morning' },
  { label: '下午 (12-18)', value: 'afternoon' },
  { label: '晚上 (18-24)', value: 'evening' }
]

// 日期选择器快捷方式
const dateShortcuts = [
  {
    text: '今天',
    value: () => {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      return now
    }
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      date.setHours(0, 0, 0, 0)
      return date
    }
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() - 7)
      return date
    }
  }
]

// ==================== Methods ====================

/**
 * 判断快捷预设是否激活
 */
function isPresetActive(presetValue: string): boolean {
  return activePreset.value === presetValue
}

/**
 * 判断自定义预设是否激活
 */
function isCustomPresetActive(presetValue: string): boolean {
  if (!currentRange.value) return false
  
  const start = new Date(currentRange.value.start)
  const end = new Date(currentRange.value.end)
  
  switch (presetValue) {
    case 'allDay':
      return start.getHours() === 0 && end.getHours() === 23
    case 'morning':
      return start.getHours() === 8 && end.getHours() === 12
    case 'afternoon':
      return start.getHours() === 12 && end.getHours() === 18
    case 'evening':
      return start.getHours() === 18 && end.getHours() === 23
    default:
      return false
  }
}

/**
 * 处理快捷选择
 */
function handleQuickSelect(presetValue: string) {
  const now = new Date()
  let start: Date
  let end: Date = new Date()
  end.setHours(23, 59, 59, 999)

  switch (presetValue) {
    case 'today':
      start = new Date()
      start.setHours(0, 0, 0, 0)
      break
    
    case 'yesterday':
      start = new Date()
      start.setDate(now.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end = new Date()
      end.setDate(now.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    
    case 'thisWeek':
      start = new Date()
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      break
    
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      break
    
    case 'last7days':
      start = new Date()
      start.setDate(now.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      break
    
    case 'last30days':
      start = new Date()
      start.setDate(now.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      break
    
    default:
      return
  }

  startDate.value = start.toISOString()
  endDate.value = end.toISOString()
  activePreset.value = presetValue
  
  handleDateChange()
}

/**
 * 处理自定义预设
 */
function handleCustomPreset(presetValue: string) {
  if (!startDate.value) {
    ElMessage.warning('请先选择日期')
    return
  }

  const baseDate = new Date(startDate.value)
  let start: Date
  let end: Date

  switch (presetValue) {
    case 'allDay':
      start = new Date(baseDate)
      start.setHours(0, 0, 0, 0)
      end = new Date(baseDate)
      end.setHours(23, 59, 59, 999)
      break
    
    case 'morning':
      start = new Date(baseDate)
      start.setHours(8, 0, 0, 0)
      end = new Date(baseDate)
      end.setHours(12, 0, 0, 0)
      break
    
    case 'afternoon':
      start = new Date(baseDate)
      start.setHours(12, 0, 0, 0)
      end = new Date(baseDate)
      end.setHours(18, 0, 0, 0)
      break
    
    case 'evening':
      start = new Date(baseDate)
      start.setHours(18, 0, 0, 0)
      end = new Date(baseDate)
      end.setHours(23, 59, 59, 999)
      break
    
    default:
      return
  }

  startDate.value = start.toISOString()
  endDate.value = end.toISOString()
  
  handleDateChange()
}

/**
 * 禁用开始日期
 */
function disabledStartDate(date: Date): boolean {
  if (!props.allowFuture && date > new Date()) {
    return true
  }
  
  if (endDate.value) {
    return date > new Date(endDate.value)
  }
  
  return false
}

/**
 * 禁用结束日期
 */
function disabledEndDate(date: Date): boolean {
  if (!props.allowFuture && date > new Date()) {
    return true
  }
  
  if (startDate.value) {
    const start = new Date(startDate.value)
    const maxEnd = new Date(start)
    maxEnd.setDate(start.getDate() + props.maxRange)
    
    return date < start || date > maxEnd
  }
  
  return false
}

/**
 * 处理日期变化
 */
function handleDateChange() {
  if (!startDate.value || !endDate.value) {
    return
  }

  const start = new Date(startDate.value)
  const end = new Date(endDate.value)

  // 验证时间范围
  if (end < start) {
    ElMessage.warning('结束时间不能早于开始时间')
    endDate.value = ''
    return
  }

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff > props.maxRange) {
    ElMessage.warning(`时间范围不能超过 ${props.maxRange} 天`)
    endDate.value = ''
    return
  }

  activePreset.value = ''
  emitChange()
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 计算时长
 */
function calculateDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diff = end.getTime() - start.getTime()

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  const parts: string[] = []
  if (days > 0) parts.push(`${days} 天`)
  if (hours > 0) parts.push(`${hours} 小时`)
  if (minutes > 0) parts.push(`${minutes} 分钟`)

  return parts.join(' ') || '0 分钟'
}

/**
 * 清除选择
 */
function handleClear() {
  startDate.value = ''
  endDate.value = ''
  activePreset.value = ''
  emitChange()
  ElMessage.info('已清除时间范围')
}

/**
 * 确认选择
 */
function handleConfirm() {
  if (!currentRange.value) {
    ElMessage.warning('请先选择时间范围')
    return
  }
  emit('confirm')
  ElMessage.success('已确认时间范围')
}

/**
 * 发送变更事件
 */
function emitChange() {
  const value = currentRange.value
  emit('update:modelValue', value)
  emit('change', value)
}

// ==================== Watch ====================

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      startDate.value = newVal.start
      endDate.value = newVal.end
    } else {
      startDate.value = ''
      endDate.value = ''
      activePreset.value = ''
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.time-range-selector {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

// 头部
.selector-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

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

// 快捷选择
.quick-select-section {
  margin-bottom: 20px;

  .section-label {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .quick-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;

    .el-button {
      justify-content: center;
    }
  }
}

// 自定义范围
.custom-range-section {
  margin-bottom: 20px;

  .section-label {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .date-inputs {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 16px;

    .date-input-item {
      flex: 1;

      label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }

      .el-date-picker {
        width: 100%;
      }
    }

    .range-separator {
      margin-bottom: 8px;
      font-size: 18px;
      color: var(--el-text-color-placeholder);
    }
  }

  .range-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .preset-tag {
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }
  }
}

// 预览
.range-preview {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;

  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .preview-content {
    margin-bottom: 16px;

    .preview-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      font-size: 13px;

      &:not(:last-child) {
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      .label {
        min-width: 60px;
        color: var(--el-text-color-secondary);
      }

      .value {
        color: var(--el-text-color-primary);
        font-weight: 500;
      }
    }
  }

  .preview-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}

// 响应式
@media (max-width: 768px) {
  .time-range-selector {
    padding: 16px;
  }

  .quick-select-section {
    .quick-buttons {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .custom-range-section {
    .date-inputs {
      flex-direction: column;

      .range-separator {
        display: none;
      }
    }
  }
}
</style>