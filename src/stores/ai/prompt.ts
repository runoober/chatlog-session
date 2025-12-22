/**
 * 提示词状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  Prompt, 
  PromptRecord,
  PromptCategory,
  PromptVariable
} from '@/types/ai'
import { VariableType } from '@/types/ai'
import { aiDB } from '@/utils/ai-db'

export const usePromptStore = defineStore('prompt', () => {
  // ==================== State ====================

  /**
   * 所有提示词
   */
  const prompts = ref<PromptRecord[]>([])

  /**
   * 收藏的提示词 ID
   */
  const favoriteIds = ref<Set<number>>(new Set())

  /**
   * 最近使用的提示词 ID（最多保留 10 个）
   */
  const recentIds = ref<number[]>([])

  /**
   * 当前选中的提示词
   */
  const currentPrompt = ref<PromptRecord | null>(null)

  /**
   * 加载状态
   */
  const loading = ref<boolean>(false)

  // ==================== Getters ====================

  /**
   * 按分类获取提示词
   */
  const promptsByCategory = computed(() => {
    return (category: PromptCategory): PromptRecord[] => {
      if (category === 'all') {
        return prompts.value
      }
      return prompts.value.filter(p => p.category === category)
    }
  })

  /**
   * 收藏的提示词
   */
  const favoritePrompts = computed((): PromptRecord[] => {
    return prompts.value.filter(p => favoriteIds.value.has(p.id!))
  })

  /**
   * 最近使用的提示词
   */
  const recentPrompts = computed((): PromptRecord[] => {
    return recentIds.value
      .map(id => prompts.value.find(p => p.id === id))
      .filter(p => p !== undefined) as PromptRecord[]
  })

  /**
   * 内置提示词
   */
  const builtInPrompts = computed((): PromptRecord[] => {
    return prompts.value.filter(p => p.isBuiltIn)
  })

  /**
   * 自定义提示词
   */
  const customPrompts = computed((): PromptRecord[] => {
    return prompts.value.filter(p => !p.isBuiltIn)
  })

  /**
   * 按使用次数排序的提示词
   */
  const popularPrompts = computed((): PromptRecord[] => {
    return [...prompts.value].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
  })

  // ==================== Actions ====================

  /**
   * 加载所有提示词
   */
  async function loadPrompts(): Promise<void> {
    loading.value = true
    try {
      const allPrompts = await aiDB.getAllPrompts()
      prompts.value = allPrompts
      
      // 更新收藏列表
      favoriteIds.value = new Set(
        allPrompts.filter(p => p.isFavorite).map(p => p.id!)
      )
      
      console.log(`✅ 加载了 ${allPrompts.length} 个提示词`)
    } catch (error) {
      console.error('加载提示词失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取单个提示词
   */
  async function getPrompt(id: number): Promise<PromptRecord | null> {
    try {
      return await aiDB.getPrompt(id)
    } catch (error) {
      console.error('获取提示词失败:', error)
      return null
    }
  }

  /**
   * 保存提示词
   */
  async function savePrompt(prompt: Prompt): Promise<number> {
    try {
      const id = await aiDB.savePrompt(prompt)
      await loadPrompts()
      return id
    } catch (error) {
      console.error('保存提示词失败:', error)
      throw error
    }
  }

  /**
   * 删除提示词
   */
  async function deletePrompt(id: number): Promise<void> {
    try {
      await aiDB.deletePrompt(id)
      await loadPrompts()
      
      // 同时从收藏和最近使用中移除
      favoriteIds.value.delete(id)
      recentIds.value = recentIds.value.filter(rid => rid !== id)
    } catch (error) {
      console.error('删除提示词失败:', error)
      throw error
    }
  }

  /**
   * 搜索提示词
   */
  async function searchPrompts(keyword: string): Promise<PromptRecord[]> {
    try {
      return await aiDB.searchPrompts(keyword)
    } catch (error) {
      console.error('搜索提示词失败:', error)
      return []
    }
  }

  /**
   * 切换收藏状态
   */
  async function toggleFavorite(id: number): Promise<void> {
    const prompt = prompts.value.find(p => p.id === id)
    if (!prompt) return

    prompt.isFavorite = !prompt.isFavorite
    
    if (prompt.isFavorite) {
      favoriteIds.value.add(id)
    } else {
      favoriteIds.value.delete(id)
    }

    await aiDB.savePrompt(prompt)
  }

  /**
   * 记录提示词使用
   */
  async function recordUsage(id: number): Promise<void> {
    try {
      // 获取提示词并更新使用次数
      const prompt = await aiDB.getPrompt(id)
      if (prompt) {
        prompt.usageCount = (prompt.usageCount || 0) + 1
        await aiDB.savePrompt(prompt)
      }
      
      // 更新最近使用列表
      recentIds.value = recentIds.value.filter(rid => rid !== id)
      recentIds.value.unshift(id)
      
      // 最多保留 10 个
      if (recentIds.value.length > 10) {
        recentIds.value = recentIds.value.slice(0, 10)
      }
      
      // 重新加载以更新使用计数
      await loadPrompts()
    } catch (error) {
      console.error('记录提示词使用失败:', error)
    }
  }

  /**
   * 提取提示词中的变量
   */
  function extractVariables(content: string): string[] {
    const regex = /\{([^}]+)\}/g
    const matches = content.matchAll(regex)
    const variables = new Set<string>()
    
    for (const match of matches) {
      variables.add(match[1])
    }
    
    return Array.from(variables)
  }

  /**
   * 填充提示词变量
   */
  function fillPrompt(prompt: Prompt, values: Record<string, string | number | boolean>): string {
    let content = prompt.content
    
    for (const variable of prompt.variables) {
      const value = values[variable.name]
      if (value !== undefined && value !== null) {
        const pattern = new RegExp(`\\{${variable.name}\\}`, 'g')
        content = content.replace(pattern, String(value))
      }
    }
    
    return content
  }

  /**
   * 验证变量值
   */
  function validateVariableValues(
    prompt: Prompt, 
    values: Record<string, string | number | boolean>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    for (const variable of prompt.variables) {
      if (variable.required && !values[variable.name]) {
        errors.push(`缺少必需变量: ${variable.name}`)
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 创建提示词
   */
  function createPrompt(
    title: string,
    content: string,
    category: PromptCategory = 'custom',
    description?: string
  ): Prompt {
    const variableNames = extractVariables(content)
    const variables: PromptVariable[] = variableNames.map(name => ({
      name,
      type: inferVariableType(name),
      description: '',
      required: true
    }))

    return {
      title,
      content,
      category,
      description,
      variables,
      isFavorite: false,
      isBuiltIn: false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * 推断变量类型
   */
  function inferVariableType(name: string): VariableType {
    const lowerName = name.toLowerCase()
    
    if (lowerName.includes('session')) return VariableType.SESSION
    if (lowerName.includes('user')) return VariableType.USER
    if (lowerName.includes('time') || lowerName.includes('date')) return VariableType.TIME_RANGE
    if (lowerName.includes('message')) return VariableType.MESSAGES
    if (lowerName.includes('keyword') || lowerName.includes('query')) return VariableType.KEYWORD
    if (lowerName.includes('number') || lowerName.includes('count')) return VariableType.NUMBER
    if (lowerName.includes('choice') || lowerName.includes('option')) return VariableType.CHOICE
    
    return VariableType.TEXT
  }

  /**
   * 初始化内置提示词
   */
  async function initBuiltInPrompts(): Promise<void> {
    const existingPrompts = await aiDB.getAllPrompts()
    const hasBuiltIn = existingPrompts.some(p => p.isBuiltIn)
    
    if (hasBuiltIn) {
      console.log('内置提示词已存在，跳过初始化')
      return
    }

    const builtInPrompts: Prompt[] = [
      // ===== 总结类 =====
      {
        title: '总结今天的聊天',
        content: '请总结 {timeRange} 在 {sessions} 的主要聊天内容：\n\n要求：\n- 按主题分类\n- 提取关键信息\n- 标注重要决策\n- 简洁明了',
        category: 'summary',
        description: '快速总结指定时间范围内的聊天内容',
        icon: '📝',
        variables: [
          { name: 'timeRange', type: VariableType.TIME_RANGE, description: '时间范围', required: true },
          { name: 'sessions', type: VariableType.SESSION, description: '要总结的会话', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '会议纪要生成',
        content: '基于以下会议记录，生成标准会议纪要：\n\n{messages}\n\n格式要求：\n1. 会议时间和参与者\n2. 讨论议题\n3. 决策事项\n4. 待办任务（责任人和截止时间）\n5. 下次会议安排',
        category: 'summary',
        description: '将聊天记录转换为正式的会议纪要',
        icon: '📋',
        variables: [
          { name: 'messages', type: VariableType.MESSAGES, description: '会议消息', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '周报生成',
        content: '基于本周的聊天记录生成工作周报：\n\n会话范围：{sessions}\n时间范围：{timeRange}\n\n请按以下格式输出：\n\n## 本周工作总结\n\n## 重点项目进展\n\n## 遇到的问题\n\n## 下周计划',
        category: 'summary',
        description: '自动生成工作周报',
        icon: '📊',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '工作相关会话', required: true },
          { name: 'timeRange', type: VariableType.TIME_RANGE, description: '本周时间范围', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '对话摘要',
        content: '请用 3-5 句话总结以下对话的核心内容：\n\n{messages}\n\n要求：抓住关键点，去除冗余信息。',
        category: 'summary',
        description: '快速提取对话核心内容',
        icon: '💬',
        variables: [
          { name: 'messages', type: VariableType.MESSAGES, description: '要总结的消息', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // ===== 搜索类 =====
      {
        title: '关键词搜索',
        content: '在 {sessions} 的历史消息中，查找所有包含 "{keyword}" 的相关内容：\n\n要求：\n- 按时间排序\n- 标注发送者\n- 提供上下文',
        category: 'search',
        description: '搜索包含特定关键词的消息',
        icon: '🔍',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '搜索范围', required: true },
          { name: 'keyword', type: VariableType.KEYWORD, description: '搜索关键词', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '问答检索',
        content: '在 {sessions} 的历史消息中，查找以下问题的答案：\n\n问题：{question}\n\n要求：\n- 引用原文\n- 标注消息来源和时间\n- 如果有多个答案，全部列出',
        category: 'search',
        description: '从聊天记录中找答案',
        icon: '❓',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '搜索范围', required: true },
          { name: 'question', type: VariableType.TEXT, description: '问题', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '用户发言查询',
        content: '查找 {user} 在 {sessions} 中关于 "{topic}" 的所有发言：\n\n要求：\n- 按时间顺序排列\n- 包含上下文\n- 标注关键观点',
        category: 'search',
        description: '查询特定用户的相关发言',
        icon: '👤',
        variables: [
          { name: 'user', type: VariableType.USER, description: '用户', required: true },
          { name: 'sessions', type: VariableType.SESSION, description: '会话范围', required: true },
          { name: 'topic', type: VariableType.TEXT, description: '话题', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // ===== 分析类 =====
      {
        title: '情感分析',
        content: '分析 {sessions} 在 {timeRange} 的聊天氛围：\n\n分析维度：\n1. 整体情绪倾向（积极/消极/中性）\n2. 争议话题识别\n3. 成员活跃度\n4. 关键时刻\n\n请用图表和数据可视化展示结果。',
        category: 'analysis',
        description: '分析聊天的情感倾向',
        icon: '😊',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '分析范围', required: true },
          { name: 'timeRange', type: VariableType.TIME_RANGE, description: '时间范围', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '用户画像',
        content: '基于 {user} 在 {sessions} 的发言记录，生成用户画像：\n\n分析内容：\n1. 活跃时段分布\n2. 主要关注话题\n3. 沟通风格特点\n4. 在团队中的角色\n5. 常用词汇和表达\n\n请生成详细的分析报告。',
        category: 'analysis',
        description: '生成用户的行为画像',
        icon: '👥',
        variables: [
          { name: 'user', type: VariableType.USER, description: '分析对象', required: true },
          { name: 'sessions', type: VariableType.SESSION, description: '数据来源', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '话题趋势分析',
        content: '分析 {sessions} 中关于 "{topic}" 的讨论趋势：\n\n时间范围：{timeRange}\n\n分析内容：\n1. 讨论热度变化\n2. 主要观点演变\n3. 参与者态度变化\n4. 关键转折点\n\n请以时间线形式呈现。',
        category: 'analysis',
        description: '追踪特定话题的讨论趋势',
        icon: '📈',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '分析范围', required: true },
          { name: 'topic', type: VariableType.TEXT, description: '话题', required: true },
          { name: 'timeRange', type: VariableType.TIME_RANGE, description: '时间范围', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: '群聊活跃度报告',
        content: '生成 {sessions} 的活跃度分析报告：\n\n分析周期：{timeRange}\n\n报告内容：\n1. 消息量统计（总数、日均、峰值）\n2. 活跃成员排名（发言次数、字数）\n3. 活跃时段分布\n4. 互动网络图\n5. 沉默成员识别\n\n请用表格和图表展示数据。',
        category: 'analysis',
        description: '分析群聊的活跃程度',
        icon: '📊',
        variables: [
          { name: 'sessions', type: VariableType.SESSION, description: '分析群聊', required: true },
          { name: 'timeRange', type: VariableType.TIME_RANGE, description: '分析周期', required: true }
        ],
        isFavorite: false,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // 批量保存内置提示词
    for (const prompt of builtInPrompts) {
      await aiDB.savePrompt(prompt)
    }

    await loadPrompts()
    console.log(`✅ 已初始化 ${builtInPrompts.length} 个内置提示词`)
  }

  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await loadPrompts()
    
    // 如果没有提示词，初始化内置提示词
    if (prompts.value.length === 0) {
      await initBuiltInPrompts()
    }
  }

  return {
    // State
    prompts,
    favoriteIds,
    recentIds,
    currentPrompt,
    loading,

    // Getters
    promptsByCategory,
    favoritePrompts,
    recentPrompts,
    builtInPrompts,
    customPrompts,
    popularPrompts,

    // Actions
    loadPrompts,
    getPrompt,
    savePrompt,
    deletePrompt,
    searchPrompts,
    toggleFavorite,
    recordUsage,
    extractVariables,
    fillPrompt,
    validateVariableValues,
    createPrompt,
    initBuiltInPrompts,
    init
  }
})