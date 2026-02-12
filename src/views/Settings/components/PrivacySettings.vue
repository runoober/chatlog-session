<script setup lang="ts">
import { ElMessageBox } from 'element-plus'

interface PrivacySettingsData {
  saveHistory: boolean
  autoDownloadMedia: boolean
  compressImages: boolean
}

const props = defineProps<{
  modelValue: PrivacySettingsData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PrivacySettingsData]
  exportData: []
  clearCache: []
}>()

const updateValue = <K extends keyof PrivacySettingsData>(
  key: K,
  value: PrivacySettingsData[K]
) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  })
}

const handleExportData = () => {
  emit('exportData')
}

const handleClearCache = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有缓存数据吗？此操作不可恢复。', '确认清除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    emit('clearCache')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>隐私设置</h3>
      <p>管理隐私和数据</p>
    </div>

    <el-form label-position="left" label-width="120px">
      <el-form-item label="保存历史">
        <el-switch
          :model-value="modelValue.saveHistory"
          @update:model-value="(val: string | number | boolean) => updateValue('saveHistory', val as boolean)"
        />
      </el-form-item>

      <el-form-item label="自动下载">
        <el-switch
          :model-value="modelValue.autoDownloadMedia"
          @update:model-value="(val: string | number | boolean) => updateValue('autoDownloadMedia', val as boolean)"
        />
        <span class="form-tip">自动下载图片和视频</span>
      </el-form-item>

      <el-form-item label="压缩图片">
        <el-switch
          :model-value="modelValue.compressImages"
          @update:model-value="(val: string | number | boolean) => updateValue('compressImages', val as boolean)"
        />
      </el-form-item>

      <el-form-item label="数据管理">
        <el-space>
          <el-button @click="handleExportData">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
          <el-button type="danger" @click="handleClearCache">
            <el-icon><Delete /></el-icon>
            清除缓存
          </el-button>
        </el-space>
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
