<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑提示词' : '新建提示词'"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
      label-position="left"
    >
      <!-- 基本信息 -->
      <el-form-item label="标题" prop="title">
        <el-input
          v-model="formData.title"
          placeholder="请输入提示词标题"
          clearable
        />
      </el-form-item>

      <el-form-item label="描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="2"
          placeholder="简要描述这个提示词的用途"
          clearable
        />
      </el-form-item>

      <el-form-item label="分类" prop="category">
        <el-select
          v-model="formData.category"
          placeholder="请选择分类"
          style="width: 100%"
        >
          <el-option label="📝 总结类" value="summary" />
          <el-option label="🔍 搜索类" value="search" />
          <el-option label="📊 分析类" value="analysis" />
        </el-select>
      </el-form-item>

      <el-form-item label="图标" prop="icon">
        <el-input
          v-model="formData.icon"
          placeholder="选择一个 Emoji 图标（如 📝）"
          maxlength="2"
          style="width: 200px"
        >
          <template #append>
            <el-button @click="showEmojiPicker = !showEmojiPicker">
              选择
            </el-button>
          </template>
        </el-input>
        <div v-if="showEmojiPicker" class="emoji-picker">
          <span
            v-for="emoji in commonEmojis"
            :key="emoji"
            class="emoji-item"
            @click="selectEmoji(emoji)"
          >
            {{ emoji }}
          </span>
        </div>
      </el-form-item>

      <!-- 提示词内容 -->
      <el-form-item label="提示词内容" prop="content">
        <el-input
          v-model="formData.content"
          type="textarea"
          :rows="10"
          placeholder="输入提示词内容，使用 {变量名} 标记需要填充的变量"
          show-word-limit
        />
        <div class="content-hint">
          <el-icon><InfoFilled /></el-icon>
          使用 <code>{变量名}</code> 标记变量，例如：<code>{sessionName}</code>、<code>{timeRange}</code>
        </div>
      </el-form-item>

      <!-- 变量管理 -->
      <el-form-item label="变量配置">
        <div class="variables-section">
          <div class="variables-header">
            <span class="detected-variables">
              检测到 {{ detectedVariables.length }} 个变量
            </span>
            <el-button
              size="small"
              type="primary"
              @click="handleExtractVariables"
            >
              <el-icon><Refresh /></el-icon>
              提取变量
            </el-button>
          </div>

          <div v-if="!formData.variables || formData.variables.length === 0" class="no-variables">
            <el-empty
              description="暂无变量，在内容中使用 {变量名} 标记变量"
              :image-size="60"
            />
          </div>

          <div v-else class="variables-list">
            <div
              v-for="(variable, index) in formData.variables"
              :key="index"
              class="variable-item"
            >
              <div class="variable-row">
                <el-input
                  v-model="variable.name"
                  placeholder="变量名"
                  readonly
                  style="width: 150px"
                >
                  <template #prefix>
                    <span class="var-prefix">{</span>
                  </template>
                  <template #suffix>
                    <span class="var-suffix">}</span>
                  </template>
                </el-input>

                <el-select
                  v-model="variable.type"
                  placeholder="类型"
                  style="width: 140px"
                >
                  <el-option label="文本" value="text" />
                  <el-option label="关键词" value="keyword" />
                  <el-option label="会话" value="session" />
                  <el-option label="用户" value="user" />
                  <el-option label="时间范围" value="timeRange" />
                  <el-option label="消息列表" value="messages" />
                  <el-option label="数字" value="number" />
                  <el-option label="布尔值" value="boolean" />
                </el-select>

                <el-input
                  v-model="variable.description"
                  placeholder="描述（可选）"
                  clearable
                  style="flex: 1"
                />

                <el-checkbox v-model="variable.required" label="必填" />

                <el-button
                  type="danger"
                  link
                  @click="removeVariable(index)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-form-item>

      <!-- 其他选项 -->
      <el-form-item label="其他选项">
        <el-checkbox v-model="formData.isFavorite" label="添加到收藏" />
      </el-form-item>
    </el-form>

    <!-- 预览区域 -->
    <el-divider content-position="left">
      <el-icon><View /></el-icon>
      预览
    </el-divider>
    <div class="preview-section">
      <div class="prompt-preview-card">
        <div class="preview-header">
          <span class="preview-icon">{{ formData.icon || '📄' }}</span>
          <span class="preview-title">{{ formData.title || '未命名提示词' }}</span>
          <el-tag v-if="formData.category" size="small" :type="getCategoryType(formData.category)">
            {{ getCategoryLabel(formData.category) }}
          </el-tag>
        </div>
        <p class="preview-description">{{ formData.description || '暂无描述' }}</p>
        <div class="preview-content">
          <pre>{{ formData.content || '暂无内容' }}</pre>
        </div>
        <div v-if="formData.variables && formData.variables.length > 0" class="preview-variables">
          <div class="preview-var-label">
            <el-icon><List /></el-icon>
            变量列表
          </div>
          <div class="preview-var-list">
            <el-tag
              v-for="variable in formData.variables"
              :key="variable.name"
              size="small"
              :type="variable.required ? 'danger' : 'info'"
              effect="plain"
            >
              {{ variable.name }} ({{ getVariableTypeLabel(variable.type) }})
              <span v-if="variable.required">*</span>
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          <el-icon><Check /></el-icon>
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  InfoFilled,
  Refresh,
  Delete,
  View,
  List,
  Check
} from '@element-plus/icons-vue'
import { usePromptStore } from '@/stores/ai/prompt'
import type { Prompt, PromptVariable } from '@/types/ai'
import { VariableType } from '@/types/ai'

interface Props {
  modelValue: boolean
  prompt?: Prompt | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', prompt: Prompt): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const promptStore = usePromptStore()

// 表单引用
const formRef = ref<FormInstance>()

// 状态
const saving = ref(false)
const showEmojiPicker = ref(false)

// 是否编辑模式
const isEdit = computed(() => !!props.prompt?.id)

// 表单数据
const formData = ref<Partial<Prompt>>({
  title: '',
  description: '',
  category: 'summary',
  icon: '📝',
  content: '',
  variables: [],
  isFavorite: false
})

// 常用 Emoji
const commonEmojis = [
  '📝', '📋', '📊', '🔍', '📈', '📉', '💡', '⚡',
  '🎯', '🎨', '🔧', '⚙️', '📌', '📍', '🔖', '📎',
  '✅', '❌', '⭐', '🌟', '💬', '📱', '💻', '🖥️',
  '📁', '📂', '🗂️', '📄', '📃', '📑', '📜', '📰'
]

// 检测到的变量
const detectedVariables = computed(() => {
  return promptStore.extractVariables(formData.value.content || '')
})

// 表单验证规则
const rules: FormRules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { min: 2, max: 50, message: '标题长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ],
  content: [
    { required: true, message: '请输入提示词内容', trigger: 'blur' },
    { min: 10, message: '内容至少 10 个字符', trigger: 'blur' }
  ]
}

// 获取分类标签
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    summary: '总结',
    search: '搜索',
    analysis: '分析'
  }
  return labels[category] || category
}

// 获取分类类型
function getCategoryType(category: string): 'success' | 'warning' | 'info' | undefined {
  const types: Record<string, 'success' | 'warning' | 'info'> = {
    summary: 'success',
    search: 'warning',
    analysis: 'info'
  }
  return types[category]
}

// 获取变量类型标签
function getVariableTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: '文本',
    keyword: '关键词',
    session: '会话',
    user: '用户',
    timeRange: '时间范围',
    messages: '消息列表',
    number: '数字',
    boolean: '布尔值'
  }
  return labels[type] || type
}

// 选择 Emoji
function selectEmoji(emoji: string) {
  formData.value.icon = emoji
  showEmojiPicker.value = false
}

// 提取变量
function handleExtractVariables() {
  const extractedVars = promptStore.extractVariables(formData.value.content || '')
  
  if (extractedVars.length === 0) {
    ElMessage.info('未检测到变量')
    return
  }

  // 合并现有变量和新提取的变量
  const existingVarNames = new Set(formData.value.variables?.map(v => v.name) || [])
  const newVars: PromptVariable[] = []

  extractedVars.forEach(varName => {
    if (!existingVarNames.has(varName)) {
      // 推断变量类型
      const inferredType = inferVariableType(varName)
      newVars.push({
        name: varName,
        type: inferredType,
        description: '',
        required: true
      })
    }
  })

  if (newVars.length > 0) {
    formData.value.variables = [...(formData.value.variables || []), ...newVars]
    ElMessage.success(`提取了 ${newVars.length} 个新变量`)
  } else {
    ElMessage.info('所有变量已存在')
  }
}

// 推断变量类型
function inferVariableType(name: string): VariableType {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('time') || lowerName.includes('date') || lowerName.includes('时间') || lowerName.includes('日期')) {
    return VariableType.TIME_RANGE
  }
  if (lowerName.includes('session') || lowerName.includes('会话') || lowerName.includes('群')) {
    return VariableType.SESSION
  }
  if (lowerName.includes('user') || lowerName.includes('用户') || lowerName.includes('成员')) {
    return VariableType.USER
  }
  if (lowerName.includes('message') || lowerName.includes('消息') || lowerName.includes('msg')) {
    return VariableType.MESSAGES
  }
  if (lowerName.includes('keyword') || lowerName.includes('关键词')) {
    return VariableType.KEYWORD
  }
  if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('数量')) {
    return VariableType.NUMBER
  }
  
  return VariableType.TEXT
}

// 移除变量
function removeVariable(index: number) {
  formData.value.variables?.splice(index, 1)
}

// 初始化表单数据
function initFormData() {
  if (props.prompt) {
    formData.value = {
      ...props.prompt,
      variables: props.prompt.variables ? [...props.prompt.variables] : []
    }
  } else {
    formData.value = {
      title: '',
      description: '',
      category: 'summary',
      icon: '📝',
      content: '',
      variables: [],
      isFavorite: false
    }
  }
}

// 关闭对话框
function handleClose() {
  emit('update:modelValue', false)
  formRef.value?.resetFields()
}

// 保存
async function handleSave() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch (error) {
    ElMessage.warning('请完整填写表单')
    return
  }

  saving.value = true
  try {
    const promptData: Prompt = {
      ...formData.value as Prompt,
      updatedAt: new Date()
    }

    if (!isEdit.value) {
      promptData.createdAt = new Date()
      promptData.isBuiltIn = false
      promptData.usageCount = 0
    }

    await promptStore.savePrompt(promptData)
    emit('saved', promptData)
    handleClose()
  } catch (error) {
    console.error('保存提示词失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 监听对话框打开，初始化表单
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    initFormData()
  }
})
</script>

<style scoped lang="scss">
.content-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: var(--el-color-info-light-9);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);

  code {
    padding: 2px 6px;
    background-color: var(--el-fill-color-dark);
    border-radius: 3px;
    font-family: monospace;
    color: var(--el-color-primary);
  }
}

.emoji-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);

  .emoji-item {
    font-size: 24px;
    cursor: pointer;
    text-align: center;
    padding: 8px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      background-color: var(--el-fill-color);
      transform: scale(1.2);
    }
  }
}

.variables-section {
  width: 100%;

  .variables-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .detected-variables {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }

  .no-variables {
    padding: 20px;
    text-align: center;
  }

  .variables-list {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .variable-item {
      .variable-row {
        display: flex;
        gap: 12px;
        align-items: center;

        .var-prefix,
        .var-suffix {
          color: var(--el-color-primary);
          font-weight: 600;
        }
      }
    }
  }
}

.preview-section {
  margin-top: 16px;

  .prompt-preview-card {
    padding: 16px;
    background-color: var(--el-fill-color-light);
    border-radius: 8px;
    border: 1px solid var(--el-border-color);

    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      .preview-icon {
        font-size: 20px;
      }

      .preview-title {
        flex: 1;
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .preview-description {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--el-text-color-regular);
      line-height: 1.6;
    }

    .preview-content {
      padding: 12px;
      background-color: var(--el-bg-color);
      border-radius: 6px;
      margin-bottom: 12px;

      pre {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.8;
        color: var(--el-text-color-primary);
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }

    .preview-variables {
      .preview-var-label {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-secondary);
      }

      .preview-var-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .variables-section .variables-list .variable-item .variable-row {
    flex-direction: column;
    align-items: stretch;

    .el-input,
    .el-select {
      width: 100% !important;
    }
  }

  .emoji-picker {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>