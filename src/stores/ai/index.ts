/**
 * AI 功能相关 Store 统一导出
 */

export { useLLMConfigStore } from './llm-config'
export { usePromptStore } from './prompt'
export { useAIConversationStore } from './conversation'
export { useReferenceStore } from './reference'

/**
 * 初始化所有 AI Stores
 */
export async function initAIStores(): Promise<void> {
  const { useLLMConfigStore } = await import('./llm-config')
  const { usePromptStore } = await import('./prompt')
  const { useAIConversationStore } = await import('./conversation')

  const llmConfigStore = useLLMConfigStore()
  const promptStore = usePromptStore()
  const conversationStore = useAIConversationStore()

  // 初始化各个 store
  await Promise.all([
    llmConfigStore.init(),
    promptStore.init(),
    conversationStore.init()
  ])

  console.log('✅ AI Stores 初始化完成')
}