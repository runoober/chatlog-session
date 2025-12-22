/**
 * LLM 配置状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  AIProvider, 
  LLMConfig, 
  ModelInfo, 
  UsageStats,
  ConfigPreset 
} from '@/types/ai'
import { aiDB } from '@/utils/ai-db'

export const useLLMConfigStore = defineStore('llm-config', () => {
  // ==================== State ====================

  /**
   * 当前提供商
   */
  const provider = ref<AIProvider>('claude')

  /**
   * API 密钥
   */
  const apiKey = ref<string>('')

  /**
   * Base URL（可选）
   */
  const baseUrl = ref<string>('')

  /**
   * 当前模型
   */
  const model = ref<string>('claude-3-5-sonnet-20241022')

  /**
   * 温度参数
   */
  const temperature = ref<number>(0.7)

  /**
   * 最大 Token 数
   */
  const maxTokens = ref<number>(4096)

  /**
   * Top P 参数
   */
  const topP = ref<number>(0.9)

  /**
   * 启用数据过滤
   */
  const enableDataFilter = ref<boolean>(true)

  /**
   * 显示 Token 使用统计
   */
  const showTokenUsage = ref<boolean>(true)

  /**
   * 使用缓存
   */
  const useCache = ref<boolean>(false)

  /**
   * 使用统计
   */
  const usageStats = ref<UsageStats>({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    monthlyBudget: 0,
    alerts: []
  })

  /**
   * 连接状态
   */
  const connectionStatus = ref<'connected' | 'disconnected' | 'testing'>('disconnected')

  /**
   * 最后测试时间
   */
  const lastTestTime = ref<Date | null>(null)

  /**
   * 最后错误信息
   */
  const lastError = ref<string | null>(null)

  /**
   * 可用模型列表
   */
  const availableModels = ref<Record<AIProvider, ModelInfo[]>>({
    openai: [
      { 
        id: 'gpt-4-turbo-preview', 
        name: 'GPT-4 Turbo',
        contextLength: 128000,
        pricing: { input: 0.01, output: 0.03 }
      },
      { 
        id: 'gpt-4', 
        name: 'GPT-4',
        contextLength: 8192,
        pricing: { input: 0.03, output: 0.06 }
      },
      { 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo',
        contextLength: 16385,
        pricing: { input: 0.0005, output: 0.0015 }
      },
      { 
        id: 'gpt-3.5-turbo-16k', 
        name: 'GPT-3.5 Turbo 16K',
        contextLength: 16385,
        pricing: { input: 0.001, output: 0.002 }
      }
    ],
    claude: [
      { 
        id: 'claude-3-5-sonnet-20241022', 
        name: 'Claude 3.5 Sonnet',
        contextLength: 200000,
        pricing: { input: 0.003, output: 0.015 }
      },
      { 
        id: 'claude-3-opus-20240229', 
        name: 'Claude 3 Opus',
        contextLength: 200000,
        pricing: { input: 0.015, output: 0.075 }
      },
      { 
        id: 'claude-3-sonnet-20240229', 
        name: 'Claude 3 Sonnet',
        contextLength: 200000,
        pricing: { input: 0.003, output: 0.015 }
      },
      { 
        id: 'claude-3-haiku-20240307', 
        name: 'Claude 3 Haiku',
        contextLength: 200000,
        pricing: { input: 0.00025, output: 0.00125 }
      }
    ],
    ollama: [],
    custom: []
  })

  /**
   * 配置预设
   */
  const presets: Record<string, ConfigPreset> = {
    analysis: {
      name: '分析优先',
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
      maxTokens: 4096
    },
    creative: {
      name: '创作优先',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.9,
      maxTokens: 8192
    },
    costEffective: {
      name: '成本优先',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2048
    },
    privacy: {
      name: '隐私优先',
      provider: 'ollama',
      model: 'llama3:8b',
      temperature: 0.7,
      maxTokens: 4096
    }
  }

  // ==================== Getters ====================

  /**
   * 获取当前模型信息
   */
  const currentModelInfo = computed((): ModelInfo | null => {
    const models = availableModels.value[provider.value]
    return models?.find(m => m.id === model.value) || null
  })

  /**
   * 估算成本
   */
  const estimateCost = computed(() => {
    return (inputTokens: number, outputTokens: number): number => {
      const modelInfo = currentModelInfo.value
      if (!modelInfo?.pricing) return 0
      
      const inputCost = (inputTokens / 1000) * modelInfo.pricing.input
      const outputCost = (outputTokens / 1000) * modelInfo.pricing.output
      return inputCost + outputCost
    }
  })

  /**
   * 检查是否超出预算
   */
  const isBudgetExceeded = computed((): boolean => {
    if (!usageStats.value.monthlyBudget) return false
    return usageStats.value.totalCost >= usageStats.value.monthlyBudget
  })

  /**
   * 获取配置摘要
   */
  const configSummary = computed((): string => {
    const modelInfo = currentModelInfo.value
    return `${provider.value} - ${modelInfo?.name || model.value} (T=${temperature.value})`
  })

  /**
   * 获取默认 Base URL
   */
  const getDefaultBaseUrl = computed(() => {
    const defaults: Record<AIProvider, string> = {
      openai: 'https://api.openai.com/v1',
      claude: 'https://api.anthropic.com',
      ollama: 'http://localhost:11434',
      custom: ''
    }
    return defaults[provider.value]
  })

  /**
   * 是否已配置
   */
  const isConfigured = computed((): boolean => {
    if (provider.value === 'ollama') {
      return !!model.value
    }
    return !!apiKey.value && !!model.value
  })

  // ==================== Actions ====================

  /**
   * 测试 API 连接
   */
  async function testConnection(): Promise<boolean> {
    connectionStatus.value = 'testing'
    lastError.value = null
    
    try {
      // TODO: 实现实际的 API 连接测试
      // 这里暂时模拟测试
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 模拟成功
      connectionStatus.value = 'connected'
      lastTestTime.value = new Date()
      return true
    } catch (error: any) {
      connectionStatus.value = 'disconnected'
      lastError.value = error.message
      return false
    }
  }

  /**
   * 刷新 Ollama 模型列表
   */
  async function refreshOllamaModels(): Promise<void> {
    if (provider.value !== 'ollama') return
    
    try {
      const url = baseUrl.value || getDefaultBaseUrl.value
      const response = await fetch(`${url}/api/tags`)
      const data = await response.json()
      
      availableModels.value.ollama = data.models.map((m: any) => ({
        id: m.name,
        name: m.name,
        contextLength: m.context_length || 4096,
        size: m.size,
        modified: m.modified_at,
        pricing: { input: 0, output: 0 }
      }))
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      throw error
    }
  }

  /**
   * 应用预设配置
   */
  function applyPreset(presetName: keyof typeof presets): void {
    const preset = presets[presetName]
    if (!preset) return
    
    provider.value = preset.provider
    model.value = preset.model
    temperature.value = preset.temperature
    maxTokens.value = preset.maxTokens
  }

  /**
   * 记录使用量
   */
  function trackUsage(inputTokens: number, outputTokens: number): void {
    usageStats.value.inputTokens += inputTokens
    usageStats.value.outputTokens += outputTokens
    
    const cost = estimateCost.value(inputTokens, outputTokens)
    usageStats.value.totalCost += cost
    
    // 检查预算告警
    if (usageStats.value.monthlyBudget > 0) {
      const percentage = (usageStats.value.totalCost / usageStats.value.monthlyBudget) * 100
      
      if (percentage >= 90 && !hasAlert('budget_90')) {
        usageStats.value.alerts.push({
          id: 'budget_90',
          type: 'warning',
          message: '已使用 90% 月度预算',
          timestamp: new Date()
        })
      } else if (percentage >= 100 && !hasAlert('budget_exceeded')) {
        usageStats.value.alerts.push({
          id: 'budget_exceeded',
          type: 'error',
          message: '已超出月度预算',
          timestamp: new Date()
        })
      }
    }
    
    // 保存统计到数据库
    saveUsageStatsToDb()
  }

  /**
   * 检查是否已有某个告警
   */
  function hasAlert(alertId: string): boolean {
    return usageStats.value.alerts.some(a => a.id === alertId)
  }

  /**
   * 清除告警
   */
  function clearAlert(alertId: string): void {
    usageStats.value.alerts = usageStats.value.alerts.filter(a => a.id !== alertId)
    saveUsageStatsToDb()
  }

  /**
   * 重置月度统计
   */
  function resetMonthlyUsage(): void {
    usageStats.value.inputTokens = 0
    usageStats.value.outputTokens = 0
    usageStats.value.totalCost = 0
    usageStats.value.alerts = []
    saveUsageStatsToDb()
  }

  /**
   * 设置月度预算
   */
  function setMonthlyBudget(budget: number): void {
    usageStats.value.monthlyBudget = budget
    saveUsageStatsToDb()
  }

  /**
   * 验证配置
   */
  function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!provider.value) {
      errors.push('请选择模型提供商')
    }
    
    if (provider.value !== 'ollama' && !apiKey.value) {
      errors.push('请输入 API Key')
    }
    
    if (!model.value) {
      errors.push('请选择模型')
    }
    
    if (temperature.value < 0 || temperature.value > 2) {
      errors.push('Temperature 必须在 0-2 之间')
    }
    
    if (maxTokens.value < 1 || maxTokens.value > 200000) {
      errors.push('Max Tokens 超出有效范围')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 保存配置
   */
  async function saveConfig(): Promise<void> {
    const validation = validateConfig()
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '))
    }
    
    const config: LLMConfig = {
      provider: provider.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      topP: topP.value,
      enableDataFilter: enableDataFilter.value,
      showTokenUsage: showTokenUsage.value,
      useCache: useCache.value
    }
    
    await aiDB.saveLLMConfig(config)
    console.log('✅ LLM 配置已保存')
  }

  /**
   * 加载配置
   */
  async function loadConfig(): Promise<void> {
    try {
      const config = await aiDB.getLLMConfig()
      if (config) {
        provider.value = config.provider
        apiKey.value = config.apiKey
        baseUrl.value = config.baseUrl
        model.value = config.model
        temperature.value = config.temperature
        maxTokens.value = config.maxTokens
        topP.value = config.topP
        enableDataFilter.value = config.enableDataFilter
        showTokenUsage.value = config.showTokenUsage
        useCache.value = config.useCache
        console.log('✅ LLM 配置已加载')
      }
    } catch (error) {
      console.error('加载 LLM 配置失败:', error)
    }
  }

  /**
   * 保存使用统计到数据库
   */
  async function saveUsageStatsToDb(): Promise<void> {
    try {
      await aiDB.saveUsageStats(usageStats.value)
    } catch (error) {
      console.error('保存使用统计失败:', error)
    }
  }

  /**
   * 加载使用统计
   */
  async function loadUsageStats(): Promise<void> {
    try {
      const stats = await aiDB.getUsageStats()
      if (stats) {
        usageStats.value = stats
        console.log('✅ 使用统计已加载')
      }
    } catch (error) {
      console.error('加载使用统计失败:', error)
    }
  }

  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await loadConfig()
    await loadUsageStats()
  }

  return {
    // State
    provider,
    apiKey,
    baseUrl,
    model,
    temperature,
    maxTokens,
    topP,
    enableDataFilter,
    showTokenUsage,
    useCache,
    usageStats,
    connectionStatus,
    lastTestTime,
    lastError,
    availableModels,
    presets,
    
    // Getters
    currentModelInfo,
    estimateCost,
    isBudgetExceeded,
    configSummary,
    getDefaultBaseUrl,
    isConfigured,
    
    // Actions
    testConnection,
    refreshOllamaModels,
    applyPreset,
    trackUsage,
    hasAlert,
    clearAlert,
    resetMonthlyUsage,
    setMonthlyBudget,
    validateConfig,
    saveConfig,
    loadConfig,
    saveUsageStatsToDb,
    loadUsageStats,
    init
  }
})