<!--
  流式输出动画指示器组件
  用于显示 AI 正在生成回复的动画效果
-->
<template>
  <div class="streaming-indicator">
    <div class="dots">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
    <span v-if="showText" class="text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 是否显示文本 */
  showText?: boolean
  /** 显示的文本内容 */
  text?: string
}

withDefaults(defineProps<Props>(), {
  showText: true,
  text: 'AI 正在思考...'
})
</script>

<style scoped lang="scss">
.streaming-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  animation: pulse 1.4s infinite ease-in-out;

  &:nth-child(1) {
    animation-delay: 0s;
  }

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes pulse {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>