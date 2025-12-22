<template>
  <div class="prompt-variable-form">
    <div v-if="variables.length === 0" class="empty-state">
      <el-empty description="此提示词无需填写变量" :image-size="80" />
    </div>

    <el-form
      v-else
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="left"
      @submit.prevent="handleSubmit"
    >
      <el-form-item
        v-for="variable in variables"
        :key="variable.name"
        :label="variable.description || variable.name"
        :prop="variable.name"
        :required="variable.required"
      >
        <!-- 文本输入 -->
        <el-input
          v-if="variable.type === VariableType.TEXT || variable.type === VariableType.KEYWORD"
          v-model="formData[variable.name]"
          :placeholder="`请输入${variable.description || variable.name}`"
          clearable
        >
          <template #prefix>
            <el-icon><EditPen /></el-icon>
          </template>
        </el-input>

        <!-- 会话选择器 -->
        <SessionSelector
          v-else-if="variable.type === VariableType.SESSION"
          v-model="formData[variable.name]"
          :multiple="true"
          :placeholder="`请选择${variable.description || '会话'}`"
        />

        <!-- 用户选择器 -->
        <UserSelector
          v-else-if="variable.type === VariableType.USER"
          v-model="formData[variable.name]"
          :placeholder="`请选择${variable.description || '用户'}`"
        />

        <!-- 时间范围选择器 -->
        <el-date-picker
          v-else-if="variable.type === VariableType.TIME_RANGE"
          v-model="formData[variable.name]"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm:ss"
          :shortcuts="timeRangeShortcuts"
          style="width: 100%"
        />

        <!-- 消息选择器 -->
        <MessageSelector
          v-else-if="variable.type === VariableType.MESSAGES"
          v-model="formData[variable.name]"
          :placeholder="`请选择${variable.description || '消息'}`"
        />

        <!-- 数字输入 -->
        <el-input-number
          v-else-if="variable.type === VariableType.NUMBER"
          v-model="formData[variable.name]"
          :min="0"
          :placeholder="`请输入${variable.description || variable.name}`"
          style="width: 100%"
        />

        <!-- 选择器 -->
        <el-switch
          v-else-if="variable.type === VariableType.CHOICE"
          v-model="formData[variable.name]"
        />

        <!-- 默认文本输入 -->
        <el-input
          v-else
          v-model="formData[variable.name]"
          :placeholder="`请输入${variable.description || variable.name}`"
          clearable
        />

        <div v-if="variable.description" class="variable-hint">
          {{ variable.description }}
        </div>
      </el-form-item>

      <el-form-item>
        <div class="form-actions">
          <el-button @click="handleReset">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
          <el-button type="primary" @click="handleSubmit">
            <el-icon><Check /></el-icon>
            确认填充
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 预览区域 -->
    <div v-if="previewContent && variables.length > 0" class="preview-section">
      <el-divider content-position="left">
        <el-icon><View /></el-icon>
        预览
      </el-divider>
      <div class="preview-content">
        <pre>{{ previewContent }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { EditPen, RefreshLeft, Check, View } from '@element-plus/icons-vue'
import type { PromptVariable } from '@/types/ai'
import { VariableType } from '@/types/ai'
import SessionSelector from './SessionSelector.vue'
import UserSelector from './UserSelector.vue'
import MessageSelector from './MessageSelector.vue'

interface Props {
  variables: PromptVariable[]
  promptContent: string
  initialValues?: Record<string, any>
}

interface Emits {
  (e: 'submit', values: Record<string, any>): void
  (e: 'update:values', values: Record<string, any>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = ref<Record<string, any>>({})

// 时间范围快捷选项
const timeRangeShortcuts = [
  {
    text: '今天',
    value: () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      return [start, end]
    }
  },
  {
    text: '最近 3 天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 3)
      return [start, end]
    }
  },
  {
    text: '最近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    }
  },
  {
    text: '最近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    }
  }
]

// 动态生成验证规则
const rules = computed<FormRules>(() => {
  const result: FormRules = {}
  
  props.variables.forEach(variable => {
    if (variable.required) {
      result[variable.name] = [
        {
          required: true,
          message: `请${getInputVerb(variable.type)}${variable.description || variable.name}`,
          trigger: ['blur', 'change']
        }
      ]
    }
  })
  
  return result
})

// 根据类型返回输入动词
function getInputVerb(type: VariableType | string): string {
  const verbMap: Record<string, string> = {
    [VariableType.TEXT]: '输入',
    [VariableType.KEYWORD]: '输入',
    [VariableType.SESSION]: '选择',
    [VariableType.USER]: '选择',
    [VariableType.TIME_RANGE]: '选择',
    [VariableType.MESSAGES]: '选择',
    [VariableType.NUMBER]: '输入',
    [VariableType.CHOICE]: '选择'
  }
  return verbMap[type] || '填写'
}

// 预览内容
const previewContent = computed(() => {
  if (!props.promptContent) return ''
  
  let content = props.promptContent
  
  // 替换变量
  props.variables.forEach(variable => {
    const value = formData.value[variable.name]
    if (value !== undefined && value !== null && value !== '') {
      const displayValue = formatVariableValue(variable, value)
      const pattern = new RegExp(`\\{${variable.name}\\}`, 'g')
      content = content.replace(pattern, displayValue)
    }
  })
  
  return content
})

// 格式化变量值用于显示
function formatVariableValue(variable: PromptVariable, value: any): string {
  switch (variable.type) {
    case VariableType.SESSION:
      if (Array.isArray(value)) {
        return value.map((s: { name?: string; id?: string }) => s.name || s.id).join(', ')
      }
      return (value as { name?: string; id?: string })?.name || (value as { name?: string; id?: string })?.id || String(value)
    
    case VariableType.USER:
      return (value as { name?: string; id?: string })?.name || (value as { name?: string; id?: string })?.id || String(value)
    
    case VariableType.TIME_RANGE:
      if (Array.isArray(value) && value.length === 2) {
        return `${value[0]} 至 ${value[1]}`
      }
      return String(value)
    
    case VariableType.MESSAGES:
      if (Array.isArray(value)) {
        return `${value.length} 条消息`
      }
      return String(value)
    
    case VariableType.CHOICE:
      return value ? '是' : '否'
    
    default:
      return String(value)
  }
}

// 初始化表单数据
function initFormData() {
  const data: Record<string, any> = {}
  
  props.variables.forEach(variable => {
    // 从初始值中获取
    if (props.initialValues && variable.name in props.initialValues) {
      data[variable.name] = props.initialValues[variable.name]
    }
    // 设置默认值
    else {
      switch (variable.type) {
        case VariableType.SESSION:
        case VariableType.MESSAGES:
          data[variable.name] = []
          break
        case VariableType.CHOICE:
          data[variable.name] = false
          break
        case VariableType.NUMBER:
          data[variable.name] = 0
          break
        default:
          data[variable.name] = ''
      }
    }
  })
  
  formData.value = data
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    emit('submit', { ...formData.value })
    ElMessage.success('变量填充完成')
  } catch (error) {
    ElMessage.warning('请完整填写所有必填项')
  }
}

// 重置表单
function handleReset() {
  formRef.value?.resetFields()
  initFormData()
}

// 监听变量变化，重新初始化表单
watch(() => props.variables, () => {
  initFormData()
}, { deep: true })

// 监听表单数据变化，向外emit
watch(formData, (newVal) => {
  emit('update:values', newVal)
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  initFormData()
})

// 暴露方法给父组件
defineExpose({
  validate: () => formRef.value?.validate(),
  resetFields: () => formRef.value?.resetFields(),
  getValues: () => ({ ...formData.value })
})
</script>

<style scoped lang="scss">
.prompt-variable-form {
  padding: 16px;

  .empty-state {
    padding: 40px 0;
    text-align: center;
  }

  :deep(.el-form) {
    .el-form-item {
      margin-bottom: 22px;

      .el-form-item__label {
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      .el-form-item__content {
        .variable-hint {
          margin-top: 4px;
          font-size: 12px;
          color: var(--el-text-color-secondary);
          line-height: 1.5;
        }
      }
    }
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    width: 100%;

    .el-button {
      min-width: 100px;
    }
  }

  .preview-section {
    margin-top: 24px;
    padding-top: 16px;

    .el-divider {
      margin: 0 0 16px 0;

      :deep(.el-divider__text) {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .preview-content {
      padding: 16px;
      background-color: var(--el-fill-color-light);
      border-radius: 8px;
      border: 1px solid var(--el-border-color);

      pre {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.8;
        color: var(--el-text-color-primary);
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .prompt-variable-form {
    padding: 12px;

    :deep(.el-form) {
      .el-form-item {
        .el-form-item__label {
          width: 100% !important;
          text-align: left;
          margin-bottom: 8px;
        }

        .el-form-item__content {
          margin-left: 0 !important;
        }
      }
    }

    .form-actions {
      flex-direction: column;

      .el-button {
        width: 100%;
      }
    }
  }
}
</style>