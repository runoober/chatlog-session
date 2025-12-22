<script setup lang="ts">
import { computed } from 'vue'
import { useLLMConfigStore } from '@/stores/ai/llm-config'

const llmStore = useLLMConfigStore()

// 格式化 Token 数量
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(2)}K`
  }
  return tokens.toString()
}

// 格式化成本
const formatCost = (cost: number): string => {
  return `$${cost.toFixed(4)}`
}

// 预算使用百分比
const budgetUsagePercentage = computed(() => {
  const { totalCost, monthlyBudget } = llmStore.usageStats
  if (!monthlyBudget || monthlyBudget === 0) return 0
  return Math.min((totalCost / monthlyBudget) * 100, 100)
})

// 预算状态类型
const budgetStatusType = computed<'success' | 'warning' | 'exception'>(() => {
  const percentage = budgetUsagePercentage.value
  if (percentage >= 90) return 'exception'
  if (percentage >= 70) return 'warning'
  return 'success'
})

// 总 Token 数
const totalTokens = computed(() => {
  const { inputTokens, outputTokens } = llmStore.usageStats
  return inputTokens + outputTokens
})

// Token 分布百分比
const inputTokenPercentage = computed(() => {
  if (totalTokens.value === 0) return 0
  return (llmStore.usageStats.inputTokens / totalTokens.value) * 100
})

const outputTokenPercentage = computed(() => {
  if (totalTokens.value === 0) return 0
  return (llmStore.usageStats.outputTokens / totalTokens.value) * 100
})

// 告警类型图标和颜色
const getAlertTypeConfig = (type: string) => {
  switch (type) {
    case 'budget_warning':
      return { icon: '⚠️', color: 'warning' }
    case 'budget_exceeded':
      return { icon: '🚫', color: 'danger' }
    case 'rate_limit':
      return { icon: '⏱️', color: 'info' }
    default:
      return { icon: 'ℹ️', color: 'info' }
  }
}

// 清除告警
const handleClearAlert = (alertId: string) => {
  llmStore.usageStats.alerts = llmStore.usageStats.alerts.filter(
    a => a.id !== alertId
  )
}

// 重置统计
const handleResetStats = async () => {
  if (confirm('确定要重置使用统计吗？此操作不可恢复。')) {
    // 重置使用统计
    llmStore.usageStats.inputTokens = 0
    llmStore.usageStats.outputTokens = 0
    llmStore.usageStats.totalCost = 0
    llmStore.usageStats.alerts = []
    await llmStore.saveConfig()
  }
}
</script>

<template>
  <div class="usage-stats">
    <!-- 统计卡片 -->
    <div class="stats-cards">
      <!-- Token 使用 -->
      <el-card class="stat-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-icon">📊</span>
            <span class="card-title">Token 使用</span>
          </div>
        </template>
        <div class="stat-content">
          <div class="stat-main">
            <span class="stat-value">{{ formatTokens(totalTokens) }}</span>
            <span class="stat-label">总计</span>
          </div>
          <div class="stat-breakdown">
            <div class="breakdown-item">
              <span class="breakdown-label">输入</span>
              <span class="breakdown-value">{{ formatTokens(llmStore.usageStats.inputTokens) }}</span>
              <span class="breakdown-percentage">({{ inputTokenPercentage.toFixed(1) }}%)</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">输出</span>
              <span class="breakdown-value">{{ formatTokens(llmStore.usageStats.outputTokens) }}</span>
              <span class="breakdown-percentage">({{ outputTokenPercentage.toFixed(1) }}%)</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 成本统计 -->
      <el-card class="stat-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="card-icon">💰</span>
            <span class="card-title">成本统计</span>
          </div>
        </template>
        <div class="stat-content">
          <div class="stat-main">
            <span class="stat-value">{{ formatCost(llmStore.usageStats.totalCost) }}</span>
            <span class="stat-label">总成本</span>
          </div>
          <div v-if="llmStore.usageStats.monthlyBudget" class="stat-info">
            <div class="budget-info">
              <span class="budget-label">月预算</span>
              <span class="budget-value">{{ formatCost(llmStore.usageStats.monthlyBudget) }}</span>
            </div>
            <el-progress
              :percentage="budgetUsagePercentage"
              :status="budgetStatusType"
              :stroke-width="8"
            />
          </div>
        </div>
      </el-card>
    </div>

    <!-- 预算进度条（大屏） -->
    <el-card 
      v-if="llmStore.usageStats.monthlyBudget" 
      class="budget-card"
      shadow="hover"
    >
      <template #header>
        <div class="card-header">
          <span class="card-icon">📈</span>
          <span class="card-title">预算使用情况</span>
        </div>
      </template>
      <div class="budget-content">
        <div class="budget-summary">
          <div class="budget-item">
            <span class="label">已使用</span>
            <span class="value" :class="budgetStatusType">
              {{ formatCost(llmStore.usageStats.totalCost) }}
            </span>
          </div>
          <div class="budget-item">
            <span class="label">剩余</span>
            <span class="value">
              {{ formatCost(llmStore.usageStats.monthlyBudget - llmStore.usageStats.totalCost) }}
            </span>
          </div>
          <div class="budget-item">
            <span class="label">总预算</span>
            <span class="value">
              {{ formatCost(llmStore.usageStats.monthlyBudget) }}
            </span>
          </div>
        </div>
        <el-progress
          :percentage="budgetUsagePercentage"
          :status="budgetStatusType"
          :stroke-width="12"
        >
          <template #default="{ percentage }">
            <span class="progress-text">{{ percentage.toFixed(1) }}%</span>
          </template>
        </el-progress>
      </div>
    </el-card>

    <!-- 告警列表 -->
    <div v-if="llmStore.usageStats.alerts.length > 0" class="alerts-section">
      <h4 class="alerts-title">⚠️ 告警信息</h4>
      <div class="alerts-list">
        <el-alert
          v-for="alert in llmStore.usageStats.alerts"
          :key="alert.id"
          :type="getAlertTypeConfig(alert.type).color as any"
          class="alert-item"
          :closable="true"
          @close="handleClearAlert(alert.id)"
        >
          <template #title>
            <span class="alert-icon">{{ getAlertTypeConfig(alert.type).icon }}</span>
            <span>{{ alert.message }}</span>
          </template>
          <div class="alert-time">
            {{ new Date(alert.timestamp).toLocaleString() }}
          </div>
        </el-alert>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <el-button size="small" @click="handleResetStats">
        重置统计
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.usage-stats {
  width: 100%;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-icon {
    font-size: 20px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--el-color-primary);
  }

  .stat-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}

.stat-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.breakdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;

  .breakdown-label {
    color: var(--el-text-color-regular);
  }

  .breakdown-value {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .breakdown-percentage {
    color: var(--el-text-color-secondary);
    margin-left: 4px;
  }
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.budget-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;

  .budget-label {
    color: var(--el-text-color-regular);
  }

  .budget-value {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.budget-card {
  margin-bottom: 16px;
}

.budget-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.budget-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.budget-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: var(--el-text-color-primary);

    &.success {
      color: var(--el-color-success);
    }

    &.warning {
      color: var(--el-color-warning);
    }

    &.exception {
      color: var(--el-color-danger);
    }
  }
}

.progress-text {
  font-size: 13px;
  font-weight: 600;
}

.alerts-section {
  margin-bottom: 16px;
}

.alerts-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  .alert-icon {
    margin-right: 6px;
  }

  .alert-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }

  .stat-main {
    .stat-value {
      font-size: 28px;
    }
  }

  .budget-summary {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .budget-item {
    flex-direction: row;
    justify-content: space-between;

    .value {
      font-size: 16px;
    }
  }
}
</style>