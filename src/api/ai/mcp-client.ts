/**
 * MCP (Model Context Protocol) 客户端
 * 统一的 AI 模型调用接口
 */

import type { 
  ChatOptions, 
  ChatResponse, 
  StreamChunk,
  AIProvider 
} from '@/types/ai'

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  provider: AIProvider
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

/**
 * MCP 客户端基类
 */
export abstract class MCPClient {
  protected config: MCPClientConfig

  constructor(config: MCPClientConfig) {
    this.config = config
  }

  /**
   * 发送聊天请求
   */
  abstract chat(options: ChatOptions): Promise<ChatResponse>

  /**
   * 流式聊天
   */
  abstract streamChat(
    options: ChatOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>

  /**
   * 测试连接
   */
  abstract testConnection(): Promise<boolean>
}

/**
 * 创建 MCP 客户端
 */
export function createMCPClient(config: MCPClientConfig): MCPClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAIMCPClient(config)
    case 'claude':
      return new ClaudeMCPClient(config)
    case 'ollama':
      return new OllamaMCPClient(config)
    case 'custom':
      return new CustomMCPClient(config)
    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

/**
 * OpenAI MCP 客户端
 */
class OpenAIMCPClient extends MCPClient {
  private get baseUrl(): string {
    return this.config.baseUrl || 'https://api.openai.com/v1'
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    
    return {
      id: data.id,
      model: data.model,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    }
  }

  async streamChat(
    options: ChatOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        const value = result.value
        
        if (done) {
          onChunk({ delta: '', finished: true })
          continue
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              const delta = data.choices[0]?.delta?.content || ''
              
              if (delta) {
                onChunk({ delta, finished: false })
              }

              // 检查是否完成
              if (data.choices[0]?.finish_reason) {
                onChunk({ 
                  delta: '', 
                  finished: true,
                  usage: {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0
                  }
                })
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Claude (Anthropic) MCP 客户端
 */
class ClaudeMCPClient extends MCPClient {
  private get baseUrl(): string {
    return this.config.baseUrl || 'https://api.anthropic.com/v1'
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens || 4096,
        stream: false
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`Claude API Error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    
    return {
      id: data.id,
      model: data.model,
      content: data.content[0]?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      },
      finishReason: data.stop_reason
    }
  }

  async streamChat(
    options: ChatOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens || 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(`Claude API Error: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    try {
      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        const value = result.value
        
        if (done) continue

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue
          
          try {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === 'content_block_delta') {
              const delta = data.delta?.text || ''
              if (delta) {
                onChunk({ delta, finished: false })
              }
            } else if (data.type === 'message_start') {
              inputTokens = data.message?.usage?.input_tokens || 0
            } else if (data.type === 'message_delta') {
              outputTokens = data.usage?.output_tokens || 0
            } else if (data.type === 'message_stop') {
              onChunk({ 
                delta: '', 
                finished: true,
                usage: { inputTokens, outputTokens }
              })
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Claude 没有专门的测试端点，我们发送一个最小的请求
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Ollama 本地模型客户端
 */
class OllamaMCPClient extends MCPClient {
  private get baseUrl(): string {
    return this.config.baseUrl || 'http://localhost:11434'
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false,
        options: {
          temperature: options.temperature
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout || 60000)
    })

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      id: Date.now().toString(),
      model: data.model,
      content: data.message?.content || '',
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0
      },
      finishReason: data.done ? 'stop' : 'length'
    }
  }

  async streamChat(
    options: ChatOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: true,
        options: {
          temperature: options.temperature
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()

    try {
      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        const value = result.value
        
        if (done) continue

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            
            if (data.message?.content) {
              onChunk({ delta: data.message.content, finished: false })
            }

            if (data.done) {
              onChunk({ 
                delta: '', 
                finished: true,
                usage: {
                  inputTokens: data.prompt_eval_count || 0,
                  outputTokens: data.eval_count || 0
                }
              })
            }
          } catch (e) {
            console.error('Error parsing Ollama response:', e)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * 自定义 API 客户端
 */
class CustomMCPClient extends MCPClient {
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(this.config.baseUrl || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey || ''}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    })

    if (!response.ok) {
      throw new Error(`Custom API Error: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      id: data.id || Date.now().toString(),
      model: data.model || options.model,
      content: data.content || data.message?.content || '',
      usage: {
        inputTokens: data.usage?.input_tokens || data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.output_tokens || data.usage?.completion_tokens || 0
      },
      finishReason: data.finish_reason || 'stop'
    }
  }

  async streamChat(
    options: ChatOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    // 自定义 API 的流式实现取决于具体 API
    // 这里提供一个基础实现
    const response = await this.chat(options)
    onChunk({ delta: response.content, finished: false })
    onChunk({ delta: '', finished: true, usage: response.usage })
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.config.baseUrl || '', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}