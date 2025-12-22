<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLLMConfigStore } from '@/stores/ai/llm-config'
import type { ConfigPreset } from '@/types/ai'
import ProviderSelector from './ProviderSelector.vue'
import ModelSelector from './ModelSelector.vue'
import UsageStats from './UsageStats.vue'
import ConfigPresets from './ConfigPresets.vue'

const llmStore = useLLMConfigStore()

// 测试连接状态
const testing = ref(false)

// 配置表单
const form = computed({
  get: () => ({
    provider: llmStore.provider,
    apiKey: llmStore.apiKey,
    baseUrl: llmStore.baseUrl,
    model: llmStore.model,
    temperature: llmStore.temperature,
    maxTokens: llmStore.maxTokens,
    topP: llmStore.topP,
    enableDataFilter: llmStore.enableDataFilter,
    showTokenUsage: llmStore.showTokenUsage,
    useCache: llmStore.useCache
  }),
  set: (value) => {
    llmStore.provider = value.provider
    llmStore.apiKey = value.apiKey
    llmStore.baseUrl = value.baseUrl
    llmStore.model = value.model
    llmStore.temperature = value.temperature
    llmStore.maxTokens = value.maxTokens
    llmStore.topP = value.topP
    llmStore.enableDataFilter = value.enableDataFilter
    llmStore.showTokenUsage = value.showTokenUsage
    llmStore.useCache = value.useCache
  }
})

// 显示 API Key（默认隐藏）
const showApiKey = ref(false)

// 当 provider 改变时，自动设置默认 baseUrl
watch(() => form.value.provider, (newProvider) => {
  const defaults = {
    openai: 'https://api.openai.com',
    claude: 'https://api.anthropic.com',
    ollama: 'http://localhost:11434',
    custom: ''
  }
  if (!form.value.baseUrl || form.value.baseUrl === defaults[llmStore.provider]) {
    form.value.baseUrl = defaults[newProvider] || ''
  }
})

// 测试连接
const handleTestConnection = async () => {
  // 验证配置
  const validation = llmStore.validateConfig()
  if (!validation.valid) {
    ElMessage.error(validation.errors.join('\n'))
    return
  }

  testing.value = true
  try {
    const result = await llmStore.testConnection()
    if (result) {
      ElMessage.success('连接测试成功！')
    } else {
      ElMessage.error('连接测试失败，请检查配置')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    ElMessage.error(`连接失败: ${message}`)
  } finally {
    testing.value = false
  }
}

// 保存配置
const handleSave = async () => {
  // 验证配置
  const validation = llmStore.validateConfig()
  if (!validation.valid) {
    ElMessage.error(validation.errors.join('\n'))
    return
  }

  try {
    await llmStore.saveConfig()
    ElMessage.success('配置已保存')
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    ElMessage.error(`保存失败: ${message}`)
  }
}

// 重置配置
const handleReset = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重置配置吗？这将清除所有设置。',
      '重置配置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    // 重置为默认值
    llmStore.provider = 'openai'
    llmStore.apiKey = ''
    llmStore.baseUrl = 'https://api.openai.com'
    llmStore.model = 'gpt-4-turbo-preview'
    llmStore.temperature = 0.7
    llmStore.maxTokens = 4096
    llmStore.topP = 1.0
    llmStore.enableDataFilter = true
    llmStore.showTokenUsage = true
    llmStore.useCache = false
    ElMessage.success('配置已重置')
  } catch {
    // 用户取消
  }
}

// 应用预设
const handleApplyPreset = (preset: ConfigPreset) => {
  llmStore.applyPreset(preset.name)
  ElMessage.success(`已应用预设: ${preset.name}`)
}

// 刷新 Ollama 模型
const refreshingModels = ref(false)
const handleRefreshOllamaModels = async () => {
  refreshingModels.value = true
  try {
    await llmStore.refreshOllamaModels()
    ElMessage.success('Ollama 模型列表已更新')
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    ElMessage.error(`刷新失败: ${message}`)
  } finally {
    refreshingModels.value = false
  }
}

// 连接状态显示
const connectionStatusText = computed(() => {
  if (llmStore.connectionStatus === 'connected') {
    return '已连接'
  } else if (llmStore.connectionStatus === 'testing') {
    return '测试中...'
  } else {
    return '未连接'
  }
})

const connectionStatusType = computed(() => {
  if (llmStore.connectionStatus === 'connected') {
    return 'success'
  } else if (llmStore.connectionStatus === 'testing') {
    return 'warning'
  } else {
    return 'info'
  }
})
</script>

<template>
  <div class="llm-config-panel">
    <!-- 配置预设 -->
    <div class="config-section">
      <h3 class="section-title">快速预设</h3>
      <ConfigPresets @apply="handleApplyPreset" />
    </div>

    <el-divider />

    <!-- 基础配置 -->
    <div class="config-section">
      <h3 class="section-title">基础配置</h3>

      <!-- 提供商选择 -->
      <el-form-item label="AI 提供商">
        <ProviderSelector v-model="form.provider" />
      </el-form-item>

      <!-- API Key -->
      <el-form-item 
        v-if="form.provider !== 'ollama'"
        label="API Key"
      >
        <el-input
          v-model="form.apiKey"
          :type="showApiKey ? 'text' : 'password'"
          placeholder="请输入 API Key"
          clearable
        >
          <template #append>
            <el-button 
              :icon="showApiKey ? 'View' : 'Hide'"
              @click="showApiKey = !showApiKey"
            />
          </template>
        </el-input>
      </el-form-item>

      <!-- Base URL -->
      <el-form-item label="API 地址">
        <el-input
          v-model="form.baseUrl"
          placeholder="API Base URL"
          clearable
        >
          <template v-if="form.provider === 'ollama'" #append>
          <el-button 
            :icon="'Refresh'"
            :loading="refreshingModels"
            @click="handleRefreshOllamaModels"
          >
            刷新模型
          </el-button>
          </template>
        </el-input>
      </el-form-item>

      <!-- 模型选择 -->
      <el-form-item label="模型">
        <ModelSelector v-model="form.model" :provider="form.provider" />
      </el-form-item>

      <!-- 连接状态 -->
      <el-form-item label="连接状态">
        <el-tag :type="connectionStatusType">
          {{ connectionStatusText }}
        </el-tag>
        <span v-if="llmStore.lastTestTime" class="last-test-time">
          最后测试: {{ new Date(llmStore.lastTestTime).toLocaleString() }}
        </span>
      </el-form-item>

      <!-- 测试连接按钮 -->
      <el-form-item>
        <el-button 
          type="primary" 
          :loading="testing"
          @click="handleTestConnection"
        >
          测试连接
        </el-button>
      </el-form-item>
    </div>

    <el-divider />

    <!-- 模型参数 -->
    <div class="config-section">
      <h3 class="section-title">模型参数</h3>

      <!-- Temperature -->
      <el-form-item label="Temperature">
        <el-slider
          v-model="form.temperature"
          :min="0"
          :max="2"
          :step="0.1"
          show-input
          :input-size="'small'"
        />
        <div class="param-hint">
          控制输出的随机性。值越高，输出越随机；值越低，输出越确定。
        </div>
      </el-form-item>

      <!-- Max Tokens -->
      <el-form-item label="最大 Token 数">
        <el-input-number
          v-model="form.maxTokens"
          :min="1"
          :max="128000"
          :step="100"
        />
        <div class="param-hint">
          单次响应的最大 Token 数量。
        </div>
      </el-form-item>

      <!-- Top P -->
      <el-form-item label="Top P">
        <el-slider
          v-model="form.topP"
          :min="0"
          :max="1"
          :step="0.05"
          show-input
          :input-size="'small'"
        />
        <div class="param-hint">
          核采样参数。控制模型考虑的 token 范围。
        </div>
      </el-form-item>
    </div>

    <el-divider />

    <!-- 隐私与安全 -->
    <div class="config-section">
      <h3 class="section-title">隐私与安全</h3>

      <el-form-item>
        <el-checkbox v-model="form.enableDataFilter">
          启用数据过滤（自动过滤敏感信息）
        </el-checkbox>
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.showTokenUsage">
          显示 Token 使用统计
        </el-checkbox>
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.useCache">
          启用响应缓存（节省成本）
        </el-checkbox>
      </el-form-item>
    </div>

    <el-divider />

    <!-- 使用统计 -->
    <div v-if="form.showTokenUsage" class="config-section">
      <h3 class="section-title">使用统计</h3>
      <UsageStats />
    </div>

    <!-- 错误提示 -->
    <el-alert
      v-if="llmStore.lastError"
      type="error"
      :title="llmStore.lastError"
      style="margin-top: 16px;"
      show-icon
      closable
      @close="llmStore.lastError = ''"
    />

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button @click="handleReset">重置</el-button>
      <el-button type="primary" @click="handleSave">保存配置</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.llm-config-panel {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.config-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.param-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.last-test-time {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .llm-config-panel {
    padding: 12px;
  }

  .section-title {
    font-size: 14px;
  }

  .action-buttons {
    flex-direction: column;

    .el-button {
      width: 100%;
    }
  }
}
</style>