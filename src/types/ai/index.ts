/**
 * AI 功能相关类型定义
 */

// ==================== LLM 配置相关 ====================

/**
 * AI 提供商类型
 */
export type AIProvider = 'openai' | 'claude' | 'ollama' | 'custom'

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string
  name: string
  contextLength: number
  pricing?: {
    input: number  // per 1K tokens
    output: number // per 1K tokens
  }
  size?: string
  modified?: string
}

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: AIProvider
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  enableDataFilter: boolean
  showTokenUsage: boolean
  useCache: boolean
}

/**
 * 使用统计告警
 */
export interface UsageAlert {
  id: string
  type: 'info' | 'warning' | 'error'
  message: string
  timestamp: Date
}

/**
 * 使用统计
 */
export interface UsageStats {
  inputTokens: number
  outputTokens: number
  totalCost: number
  monthlyBudget: number
  alerts: UsageAlert[]
}

/**
 * 配置预设
 */
export interface ConfigPreset {
  name: string
  provider: AIProvider
  model: string
  temperature: number
  maxTokens: number
}

// ==================== 提示词相关 ====================

/**
 * 变量类型
 */
export enum VariableType {
  TEXT = 'text',
  SESSION = 'session',
  USER = 'user',
  TIME_RANGE = 'timeRange',
  MESSAGES = 'messages',
  KEYWORD = 'keyword',
  NUMBER = 'number',
  CHOICE = 'choice'
}

/**
 * 提示词变量
 */
export interface PromptVariable {
  name: string
  type: VariableType
  description: string
  required: boolean
  defaultValue?: any
  options?: string[] // for CHOICE type
}

/**
 * 提示词分类
 */
export type PromptCategory = 'summary' | 'search' | 'analysis' | 'custom' | 'all'

/**
 * 提示词
 */
export interface Prompt {
  id?: number
  title: string
  content: string
  category: PromptCategory
  variables: PromptVariable[]
  description?: string
  icon?: string
  isFavorite: boolean
  isBuiltIn: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 变量建议
 */
export interface VariableSuggestion {
  variable: string
  suggestions: string[]
}

// ==================== 引用相关 ====================

/**
 * 引用类型
 */
export type ReferenceType = 'session' | 'message' | 'user' | 'timeRange'

/**
 * 时间范围
 */
export interface TimeRange {
  start: string
  end: string
}

/**
 * 引用基础接口
 */
export interface Reference {
  id: string
  type: ReferenceType
  label: string
}

/**
 * 会话引用
 */
export interface SessionReference extends Reference {
  type: 'session'
  sessionId: string
  sessionName: string
  messageCount?: number
}

/**
 * 消息引用
 */
export interface MessageReference extends Reference {
  type: 'message'
  messageIds: number[]
  sessionId: string
  preview?: string
}

/**
 * 用户引用
 */
export interface UserReference extends Reference {
  type: 'user'
  wxid: string
  displayName: string
}

/**
 * 时间范围引用
 */
export interface TimeRangeReference extends Reference {
  type: 'timeRange'
  range: TimeRange
}

// ==================== AI 对话相关 ====================

/**
 * AI 消息角色
 */
export type AIMessageRole = 'user' | 'assistant' | 'system'

/**
 * AI 消息状态
 */
export type AIMessageStatus = 'sending' | 'success' | 'error' | 'streaming'

/**
 * 上下文信息
 */
export interface ContextInfo {
  sessions?: string[]
  messages?: number[]
  users?: string[]
  timeRange?: TimeRange
  tokenCount?: number
  preview?: string
}

/**
 * AI 消息
 */
export interface AIMessage {
  id?: number
  conversationId: number
  role: AIMessageRole
  content: string
  context?: ContextInfo
  timestamp: Date
  status: AIMessageStatus
  error?: string
  tokenUsage?: {
    input: number
    output: number
    cost: number
  }
}

/**
 * AI 对话
 */
export interface AIConversation {
  id?: number
  title: string
  messages: AIMessage[]
  createdAt: Date
  updatedAt: Date
  totalTokens?: number
  totalCost?: number
}

// ==================== MCP 相关 ====================

/**
 * MCP 聊天选项
 */
export interface ChatOptions {
  messages: Array<{
    role: AIMessageRole
    content: string
    context?: ContextInfo
  }>
  model: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

/**
 * MCP 聊天响应
 */
export interface ChatResponse {
  id: string
  model: string
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  finishReason?: string
}

/**
 * MCP 流式响应块
 */
export interface StreamChunk {
  delta: string
  finished: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

// ==================== 上下文构建相关 ====================

/**
 * 上下文构建策略
 */
export type ContextBuildStrategy = 'smart' | 'random' | 'recent' | 'hierarchical'

/**
 * 优先级规则类型
 */
export type PriorityRuleType = 'keyword' | 'user' | 'time' | 'engagement'

/**
 * 优先级规则
 */
export interface PriorityRule {
  type: PriorityRuleType
  weight: number
}

/**
 * 上下文构建配置
 */
export interface ContextBuildConfig {
  maxTokens: number
  strategy: ContextBuildStrategy
  priorityRules?: PriorityRule[]
}

/**
 * 带来源的消息
 */
export interface ContextMessage {
  messageId: number
  sessionId: string
  sessionName: string
  senderName: string
  content: string
  time: string
  score?: number
}

// ==================== 数据库存储相关 ====================

/**
 * 数据库中的提示词记录
 */
export interface PromptRecord extends Prompt {
  id: number
}

/**
 * 数据库中的对话记录
 */
export interface ConversationRecord extends AIConversation {
  id: number
}

/**
 * 数据库中的消息记录
 */
export interface MessageRecord extends AIMessage {
  id: number
  conversationId: number
}

/**
 * 配置键值对
 */
export interface ConfigRecord {
  key: string
  value: any
  updatedAt: Date
}