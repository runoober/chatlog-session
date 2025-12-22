<script setup lang="ts">
import { LLMConfigPanel } from '@/components/ai'
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>AI 助手</h3>
      <p>配置 AI 大模型和 MCP 集成</p>
    </div>

    <LLMConfigPanel />
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
}
</style>