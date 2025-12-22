<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

interface ApiSettingsData {
  apiBaseUrl: string
  apiTimeout: number
  apiRetryCount: number
  apiRetryDelay: number
  enableDebug: boolean
}

const props = defineProps<{
  modelValue: ApiSettingsData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ApiSettingsData]
}>()

const testingApi = ref(false)

const apiTimeoutOptions = [
  { label: '10 秒', value: 10000 },
  { label: '30 秒', value: 30000 },
  { label: '60 秒', value: 60000 },
  { label: '120 秒', value: 120000 }
]

const retryCountOptions = [
  { label: '不重试', value: 0 },
  { label: '1 次', value: 1 },
  { label: '3 次', value: 3 },
  { label: '5 次', value: 5 }
]

const updateValue = <K extends keyof ApiSettingsData>(key: K, value: ApiSettingsData[K]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  })
}

const testApiConnection = async () => {
  testingApi.value = true
  
  try {
    // 标准化 API 地址
    let baseUrl = props.modelValue.apiBaseUrl.trim()
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), props.modelValue.apiTimeout)
    
    const response = await fetch(`${baseUrl}/api/v1/dashboard`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    // 尝试解析返回数据验证是否是有效的 API
    await response.json()
    
    ElMessage({
      type: 'success',
      message: '连接成功！API 可访问'
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      ElMessage({
        type: 'error',
        message: '连接超时，请检查 API 地址和网络连接'
      })
    } else {
      const message = error instanceof Error ? error.message : '未知错误'
      ElMessage({
        type: 'error',
        message: `连接失败: ${message}`
      })
    }
  } finally {
    testingApi.value = false
  }
}

const resetApiSettings = () => {
  emit('update:modelValue', {
    apiBaseUrl: 'http://localhost:5030',
    apiTimeout: 30000,
    apiRetryCount: 3,
    apiRetryDelay: 1000,
    enableDebug: false
  })
  ElMessage({
    type: 'success',
    message: 'API 设置已重置'
  })
}
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>API 设定</h3>
      <p>配置 Chatlog API 连接</p>
    </div>

    <el-form label-position="left" label-width="120px">
      <el-form-item label="API 地址">
        <el-input
          :model-value="modelValue.apiBaseUrl"
          placeholder="http://localhost:5030"
          style="width: 400px"
          @update:model-value="(val) => updateValue('apiBaseUrl', val)"
        >
          <template #prepend>
            <el-icon><Link /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="连接测试">
        <el-button
          type="primary"
          :loading="testingApi"
          @click="testApiConnection"
        >
          <el-icon><Connection /></el-icon>
          测试连接
        </el-button>
        <el-text type="info" size="small" style="margin-left: 12px">
          点击测试 API 是否可访问
        </el-text>
      </el-form-item>

      <el-divider />

      <el-form-item label="请求超时">
        <el-select
          :model-value="modelValue.apiTimeout"
          style="width: 200px"
          @update:model-value="(val) => updateValue('apiTimeout', val)"
        >
          <el-option
            v-for="option in apiTimeoutOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-text type="info" size="small" style="margin-left: 12px">
          API 请求的超时时间
        </el-text>
      </el-form-item>

      <el-form-item label="重试次数">
        <el-select
          :model-value="modelValue.apiRetryCount"
          style="width: 200px"
          @update:model-value="(val) => updateValue('apiRetryCount', val)"
        >
          <el-option
            v-for="option in retryCountOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-text type="info" size="small" style="margin-left: 12px">
          请求失败后的重试次数
        </el-text>
      </el-form-item>

      <el-form-item label="重试延迟">
        <el-input-number
          :model-value="modelValue.apiRetryDelay"
          :min="100"
          :max="10000"
          :step="100"
          style="width: 200px"
          @update:model-value="(val) => val !== undefined && updateValue('apiRetryDelay', val)"
        />
        <el-text type="info" size="small" style="margin-left: 12px">
          毫秒（ms）
        </el-text>
      </el-form-item>

      <el-divider />

      <el-form-item label="调试模式">
        <el-switch
          :model-value="modelValue.enableDebug"
          @update:model-value="(val: boolean) => updateValue('enableDebug', val)"
        />
        <el-text type="info" size="small" style="margin-left: 12px">
          在控制台输出 API 请求详情和调试信息
        </el-text>
      </el-form-item>

      <el-form-item>
        <el-button type="warning" @click="resetApiSettings">
          <el-icon><RefreshRight /></el-icon>
          重置 API 设置
        </el-button>
      </el-form-item>
    </el-form>

    <el-alert
      title="提示"
      type="info"
      :closable="false"
      style="margin-top: 20px"
    >
      <template #default>
        <div style="line-height: 1.8">
          <p>• API 地址格式: <code>http://host:port</code> 或 <code>https://domain.com</code></p>
          <p>• 默认地址: <code>http://localhost:5030</code></p>
          <p>• 修改设置后需要点击"保存设置"按钮才会生效</p>
          <p>• 建议先测试连接，确保 API 可访问</p>
        </div>
      </template>
    </el-alert>
  </div>
</template>

<style lang="scss" scoped>
.setting-section {
  .section-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }

  code {
    padding: 2px 6px;
    background-color: var(--el-fill-color-light);
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }
}
</style>