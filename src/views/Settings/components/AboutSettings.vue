<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { Guide } from '@element-plus/icons-vue'

interface VersionInfo {
  version: string
  buildDate: string
  gitHash?: string
  gitBranch?: string
  buildTime?: string
  isDev: boolean
}

defineProps<{
  versionInfo: VersionInfo
}>()

const emit = defineEmits<{
  'checkUpdate': []
  'restartOnboarding': []
}>()

const handleCheckUpdate = () => {
  emit('checkUpdate')
}

const handleRestartOnboarding = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重新运行新手引导吗？',
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    emit('restartOnboarding')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h3>关于 Chatlog Session</h3>
    </div>

    <div class="about-content">
      <div class="app-logo">
        <el-icon size="80" color="#07c160">
          <ChatLineSquare />
        </el-icon>
      </div>

      <div class="app-info">
        <h2>Chatlog Session</h2>
        <p class="version">版本 {{ versionInfo.version }}</p>
        <p class="build-date">构建日期: {{ versionInfo.buildDate }}</p>
        <p v-if="versionInfo.gitHash && versionInfo.gitHash !== 'unknown'" class="git-info">
          提交: {{ versionInfo.gitHash }}
        </p>
      </div>

      <div class="about-actions">
        <el-button type="primary" @click="handleCheckUpdate">
          <el-icon><Refresh /></el-icon>
          检查更新
        </el-button>
        <el-button @click="handleRestartOnboarding">
          <el-icon :size="16">
            <Guide />
          </el-icon>
          重新运行新手引导
        </el-button>
      </div>

      <el-divider />

      <div class="about-details">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="项目名称">
            Chatlog Session
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            {{ versionInfo.version }}
          </el-descriptions-item>
          <el-descriptions-item label="构建日期">
            {{ versionInfo.buildDate }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="versionInfo.buildTime && versionInfo.buildTime !== versionInfo.buildDate"
            label="构建时间"
          >
            {{ versionInfo.buildTime }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="versionInfo.gitHash && versionInfo.gitHash !== 'unknown'"
            label="Git Hash"
          >
            <el-tag size="small" type="info">{{ versionInfo.gitHash }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item
            v-if="versionInfo.gitBranch && versionInfo.gitBranch !== 'unknown'"
            label="Git 分支"
          >
            <el-tag size="small" :type="versionInfo.gitBranch === 'main' ? 'success' : 'warning'">
              {{ versionInfo.gitBranch }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="环境">
            <el-tag size="small" :type="versionInfo.isDev ? 'warning' : 'success'">
              {{ versionInfo.isDev ? '开发版本' : '生产版本' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="技术栈">
            Vue 3 + TypeScript + Vite
          </el-descriptions-item>
          <el-descriptions-item label="开源协议">
            Apache-2.0 License
          </el-descriptions-item>
          <el-descriptions-item label="项目仓库">
            <el-link
              href="https://github.com/xlight/chatlog-session"
              target="_blank"
              type="primary"
            >
              GitHub
            </el-link>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.setting-section {
  .section-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .about-content {
    .app-logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .app-info {
      text-align: center;
      margin-bottom: 32px;

      h2 {
        margin: 0 0 12px 0;
        font-size: 24px;
        font-weight: 600;
      }

      p {
        margin: 6px 0;
        color: var(--el-text-color-secondary);
        font-size: 14px;
      }

      .version {
        font-size: 16px;
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      .git-info {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
      }
    }

    .about-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 32px;
    }

    .about-details {
      margin-top: 24px;
    }
  }
}
</style>