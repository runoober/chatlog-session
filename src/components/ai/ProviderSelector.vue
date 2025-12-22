<script setup lang="ts">
import { computed } from 'vue'
import type { AIProvider } from '@/types/ai'

interface Props {
  modelValue: AIProvider
}

interface Emits {
  (e: 'update:modelValue', value: AIProvider): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const providers = [
  {
    value: 'openai' as AIProvider,
    label: 'OpenAI',
    description: 'GPT-4, GPT-3.5 等模型',
    icon: '🤖',
    popular: true
  },
  {
    value: 'claude' as AIProvider,
    label: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Opus 等',
    icon: '🧠',
    popular: true
  },
  {
    value: 'ollama' as AIProvider,
    label: 'Ollama (本地)',
    description: 'Llama3, Mistral, Qwen 等本地模型',
    icon: '💻',
    privacy: true
  },
  {
    value: 'custom' as AIProvider,
    label: '自定义 API',
    description: '兼容 OpenAI 格式的自定义接口',
    icon: '⚙️',
    advanced: true
  }
]

const selectedProvider = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="provider-selector">
    <el-radio-group v-model="selectedProvider" class="provider-group">
      <el-radio
        v-for="provider in providers"
        :key="provider.value"
        :label="provider.value"
        class="provider-option"
      >
        <div class="provider-content">
          <div class="provider-header">
            <span class="provider-icon">{{ provider.icon }}</span>
            <span class="provider-label">{{ provider.label }}</span>
            <el-tag
              v-if="provider.popular"
              type="success"
              size="small"
              effect="plain"
              class="provider-badge"
            >
              推荐
            </el-tag>
            <el-tag
              v-if="provider.privacy"
              type="warning"
              size="small"
              effect="plain"
              class="provider-badge"
            >
              隐私优先
            </el-tag>
            <el-tag
              v-if="provider.advanced"
              type="info"
              size="small"
              effect="plain"
              class="provider-badge"
            >
              高级
            </el-tag>
          </div>
          <div class="provider-description">
            {{ provider.description }}
          </div>
        </div>
      </el-radio>
    </el-radio-group>
  </div>
</template>

<style scoped lang="scss">
.provider-selector {
  width: 100%;
}

.provider-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-option {
  width: 100%;
  height: auto;
  padding: 16px;
  margin: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }

  &.is-checked {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  :deep(.el-radio__label) {
    width: 100%;
    padding-left: 8px;
  }
}

.provider-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  font-size: 20px;
  line-height: 1;
}

.provider-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.provider-badge {
  margin-left: auto;
}

.provider-description {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  padding-left: 28px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .provider-option {
    padding: 12px;
  }

  .provider-icon {
    font-size: 18px;
  }

  .provider-label {
    font-size: 14px;
  }

  .provider-description {
    font-size: 12px;
    padding-left: 26px;
  }
}
</style>