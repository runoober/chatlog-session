<script setup lang="ts">
interface ChatSettingsData {
  showTimestamp: boolean
  showAvatar: boolean
  messageGrouping: boolean
  showMediaResources: boolean
  enableServerPinning: boolean
  autoRefresh: boolean
  autoRefreshInterval: number
}

const props = defineProps<{
  modelValue: ChatSettingsData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ChatSettingsData]
}>()

const updateValue = <K extends keyof ChatSettingsData>(key: K, value: ChatSettingsData[K]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
  })
}
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>聊天设置</h3>
      <p>自定义聊天行为</p>
    </div>

    <el-form label-position="left" label-width="120px">
      <el-form-item label="显示时间">
        <el-switch
          :model-value="modelValue.showTimestamp"
          @update:model-value="(val: string | number | boolean) => updateValue('showTimestamp', val as boolean)"
        />
      </el-form-item>

      <el-form-item label="显示头像">
        <el-switch
          :model-value="modelValue.showAvatar"
          @update:model-value="(val: string | number | boolean) => updateValue('showAvatar', val as boolean)"
        />
      </el-form-item>

      <el-form-item label="消息分组">
        <el-switch
          :model-value="modelValue.messageGrouping"
          @update:model-value="(val: string | number | boolean) => updateValue('messageGrouping', val as boolean)"
        />
        <span class="form-tip">相同发送者的连续消息合并显示</span>
      </el-form-item>

      <el-form-item label="同步服务端置顶">
        <el-switch
          :model-value="modelValue.enableServerPinning"
          @update:model-value="(val: string | number | boolean) => updateValue('enableServerPinning', val as boolean)"
        />
        <span class="form-tip">关闭后仅显示本地置顶会话</span>
      </el-form-item>

      <el-divider />

      <el-form-item label="显示媒体资源">
        <el-switch
          :model-value="modelValue.showMediaResources"
          @update:model-value="(val: string | number | boolean) => updateValue('showMediaResources', val as boolean)"
        />
        <span class="form-tip">显示图片、视频、表情等外部资源</span>
      </el-form-item>

      <el-alert
        v-if="!modelValue.showMediaResources"
        type="warning"
        :closable="false"
        style="margin-top: 12px"
      >
        <template #title>
          <span style="font-size: 13px">关闭后媒体资源将显示为文本描述（如 [图片]）</span>
        </template>
        <div style="font-size: 12px; margin-top: 4px">
          适用于 Chatlog 服务无法获取附件密钥的情况
        </div>
      </el-alert>

      <el-divider />

      <el-form-item label="自动刷新">
        <el-switch
          :model-value="modelValue.autoRefresh"
          @update:model-value="(val: string | number | boolean) => updateValue('autoRefresh', val as boolean)"
        />
        <span class="form-tip">自动刷新会话列表和消息</span>
      </el-form-item>

      <el-form-item v-if="modelValue.autoRefresh" label="刷新间隔">
        <el-input-number
          :model-value="modelValue.autoRefreshInterval"
          :min="10"
          :max="300"
          :step="10"
          style="width: 200px"
          @update:model-value="
            (val: number | undefined) =>
              val !== undefined && updateValue('autoRefreshInterval', val)
          "
        />
        <el-text type="info" size="small" style="margin-left: 12px"> 秒（s） </el-text>
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
