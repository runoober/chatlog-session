<script setup lang="ts">
import { computed } from 'vue'
import { useLLMConfigStore } from '@/stores/ai/llm-config'
import type { ConfigPreset } from '@/types/ai'

interface Emits {
  (e: 'apply', preset: ConfigPreset): void
}

const emit = defineEmits<Emits>()

const llmStore = useLLMConfigStore()

// 预设列表
const presets = computed(() => {
  return Object.values(llmStore.presets)
})

// 当前激活的预设（如果当前配置完全匹配某个预设）
const activePreset = computed(() => {
  return presets.value.find(preset => {
    return (
      preset.provider === llmStore.provider &&
      preset.model === llmStore.model &&
      preset.temperature === llmStore.temperature &&
      preset.maxTokens === llmStore.maxTokens
    )
  })
})

// 应用预设
const handleApplyPreset = (preset: ConfigPreset) => {
  emit('apply', preset)
}

// 获取预设图标
const getPresetIcon = (presetName: string) => {
  const icons: Record<string, string> = {
    analysis: '🔍',
    creative: '🎨',
    costEffective: '💰',
    privacy: '🔒'
  }
  return icons[presetName] || '⚙️'
}

// 获取预设描述
const getPresetDescription = (presetName: string) => {
  const descriptions: Record<string, string> = {
    analysis: '适合数据分析、摘要生成等任务，输出更稳定',
    creative: '适合创意写作、头脑风暴等任务，输出更多样',
    costEffective: '适合日常使用，性价比高',
    privacy: '本地运行，数据不出本地，完全隐私'
  }
  return descriptions[presetName] || ''
}

// 获取预设标签
const getPresetTags = (preset: ConfigPreset) => {
  const tags = []
  
  if (preset.provider === 'ollama') {
    tags.push({ text: '本地', type: 'warning' })
  }
  
  if (preset.temperature <= 0.3) {
    tags.push({ text: '精确', type: 'success' })
  } else if (preset.temperature >= 0.8) {
    tags.push({ text: '创造', type: 'primary' })
  }
  
  if (preset.model.includes('gpt-3.5') || preset.provider === 'ollama') {
    tags.push({ text: '经济', type: 'info' })
  }
  
  return tags
}
</script>

<template>
  <div class="config-presets">
    <div class="presets-grid">
      <div
        v-for="preset in presets"
        :key="preset.name"
        class="preset-card"
        :class="{ active: activePreset?.name === preset.name }"
        @click="handleApplyPreset(preset)"
      >
        <div class="preset-header">
          <span class="preset-icon">{{ getPresetIcon(preset.name) }}</span>
          <span class="preset-name">{{ preset.name }}</span>
          <el-tag
            v-if="activePreset?.name === preset.name"
            type="success"
            size="small"
            effect="dark"
            class="active-badge"
          >
            当前
          </el-tag>
        </div>
        
        <div class="preset-description">
          {{ getPresetDescription(preset.name) }}
        </div>
        
        <div class="preset-tags">
          <el-tag
            v-for="tag in getPresetTags(preset)"
            :key="tag.text"
            :type="tag.type as any"
            size="small"
            effect="plain"
          >
            {{ tag.text }}
          </el-tag>
        </div>
        
        <div class="preset-config">
          <div class="config-item">
            <span class="config-label">提供商</span>
            <span class="config-value">{{ preset.provider }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">模型</span>
            <span class="config-value">{{ preset.model }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">Temperature</span>
            <span class="config-value">{{ preset.temperature }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">Max Tokens</span>
            <span class="config-value">{{ preset.maxTokens }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="presets-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>点击预设卡片快速应用配置</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.config-presets {
  width: 100%;
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 12px;
}

.preset-card {
  padding: 16px;
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  background-color: var(--el-bg-color);
  
  &:hover {
    border-color: var(--el-color-primary);
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  &.active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }
}

.preset-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.preset-icon {
  font-size: 24px;
  line-height: 1;
}

.preset-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
}

.active-badge {
  margin-left: auto;
}

.preset-description {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  min-height: 40px;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.preset-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.config-label {
  color: var(--el-text-color-secondary);
}

.config-value {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: monospace;
}

.presets-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .presets-grid {
    grid-template-columns: 1fr;
  }
  
  .preset-card {
    padding: 14px;
  }
  
  .preset-icon {
    font-size: 20px;
  }
  
  .preset-name {
    font-size: 14px;
  }
  
  .preset-description {
    font-size: 12px;
    min-height: auto;
  }
}
</style>