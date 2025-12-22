<script setup lang="ts">
interface AdvancedSettingsData {
  enableDebug: boolean
  cacheSize: string
}

const props = defineProps<{
  modelValue: AdvancedSettingsData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AdvancedSettingsData]
}>()

const updateValue = <K extends keyof AdvancedSettingsData>(key: K, value: AdvancedSettingsData[K]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  })
}
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>高级设置</h3>
      <p>仅供高级用户使用</p>
    </div>

    <el-form label-position="left" label-width="120px">
      <el-form-item label="调试模式">
        <el-switch
          :model-value="modelValue.enableDebug"
          @update:model-value="(val) => updateValue('enableDebug', val as boolean)"
        />
        <span class="form-tip">在控制台输出 API 请求详情和调试信息</span>
      </el-form-item>

      <el-form-item label="缓存大小">
        <el-input
          :model-value="modelValue.cacheSize"
          readonly
          style="width: 200px"
        />
      </el-form-item>
    </el-form>
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

  .form-tip {
    margin-left: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>