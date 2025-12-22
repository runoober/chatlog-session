<script setup lang="ts">
import { computed } from 'vue'
import { useLLMConfigStore } from '@/stores/ai/llm-config'
import type { AIProvider, ModelInfo } from '@/types/ai'

interface Props {
  modelValue: string
  provider: AIProvider
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const llmStore = useLLMConfigStore()

const selectedModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 根据提供商获取可用模型
const availableModels = computed(() => {
  return llmStore.availableModels[props.provider] || []
})

// 获取模型信息（用于 tooltip）
const getModelInfo = (modelId: string) => {
  const model = availableModels.value.find((m: ModelInfo) => m.id === modelId)
  if (!model) return ''
  
  const parts = []
  if (model.contextLength) {
    parts.push(`上下文: ${(model.contextLength / 1000).toFixed(0)}K tokens`)
  }
  if (model.pricing) {
    parts.push(`输入: $${model.pricing.input}/1K`)
    parts.push(`输出: $${model.pricing.output}/1K`)
  }
  
  return parts.join(' | ')
}

// 检查是否为推荐模型
const isRecommended = (modelId: string) => {
  const recommended = [
    'gpt-4-turbo-preview',
    'claude-3-5-sonnet-20241022',
    'llama3',
    'qwen2.5'
  ]
  return recommended.some(r => modelId.includes(r))
}
</script>

<template>
  <div class="model-selector">
    <el-select
      v-model="selectedModel"
      placeholder="请选择模型"
      filterable
      class="model-select"
    >
      <el-option
        v-for="model in availableModels"
        :key="model.id"
        :label="model.name || model.id"
        :value="model.id"
      >
        <div class="model-option">
          <div class="model-info">
            <span class="model-name">{{ model.name || model.id }}</span>
            <el-tag
              v-if="isRecommended(model.id)"
              type="success"
              size="small"
              effect="plain"
            >
              推荐
            </el-tag>
          </div>
          <div v-if="getModelInfo(model.id)" class="model-details">
            {{ getModelInfo(model.id) }}
          </div>
        </div>
      </el-option>
    </el-select>

    <!-- 选中模型的详细信息 -->
    <div v-if="selectedModel" class="selected-model-info">
      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item 
          v-for="model in availableModels.filter((m: ModelInfo) => m.id === selectedModel)"
          :key="model.id"
        >
          <template #label>
            <span class="info-label">模型信息</span>
          </template>
          <div class="info-content">
            <div v-if="model.contextLength">
              <strong>上下文长度:</strong> {{ (model.contextLength / 1000).toFixed(0) }}K tokens
            </div>
            <div v-if="model.pricing">
              <strong>定价:</strong> 
              输入 ${{ model.pricing.input }}/1K tokens, 
              输出 ${{ model.pricing.output }}/1K tokens
            </div>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 空状态提示 -->
    <el-alert
      v-if="availableModels.length === 0"
      type="warning"
      :closable="false"
      show-icon
    >
      <template #title>
        <span v-if="provider === 'ollama'">
          未检测到 Ollama 模型，请先安装并启动 Ollama，然后点击"刷新模型"按钮
        </span>
        <span v-else>
          暂无可用模型
        </span>
      </template>
    </el-alert>
  </div>
</template>

<style scoped lang="scss">
.model-selector {
  width: 100%;
}

.model-select {
  width: 100%;
}

.model-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.model-details {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.selected-model-info {
  margin-top: 12px;
}

.info-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.5;

  strong {
    color: var(--el-text-color-primary);
    margin-right: 4px;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .model-name {
    font-size: 13px;
  }

  .model-details {
    font-size: 11px;
  }

  .info-content {
    font-size: 12px;
  }
}
</style>