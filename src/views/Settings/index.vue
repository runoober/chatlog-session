<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNotificationStore } from '@/stores/notification'
import { useLLMConfigStore } from '@/stores/ai/llm-config'
import { useSessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { getVersion, getBuildDate, getVersionInfo } from '@/utils/version'
import { downloadJSON, downloadText, downloadMarkdown } from '@/utils/download'
import { chatlogAPI } from '@/api/chatlog'
import {
  ApiSettings,
  AiSettings,
  AppearanceSettings,
  NotificationSettings,
  ChatSettings,
  PrivacySettings,
  AdvancedSettings,
  AboutSettings,
} from './components'

const appStore = useAppStore()
const notificationStore = useNotificationStore()
const llmConfigStore = useLLMConfigStore()
const router = useRouter()

// 当前活动菜单
const activeMenu = ref('api')

// 菜单项
const menuItems = [
  { key: 'api', label: 'API 设定', icon: 'Link' },
  { key: 'ai', label: 'AI 助手', icon: 'ChatLineRound' },
  { key: 'appearance', label: '外观设置', icon: 'Brush' },
  { key: 'notifications', label: '通知设置', icon: 'Bell' },
  { key: 'chat', label: '聊天设置', icon: 'ChatDotRound' },
  { key: 'privacy', label: '隐私设置', icon: 'Lock' },
  { key: 'advanced', label: '高级设置', icon: 'Setting' },
  { key: 'about', label: '关于', icon: 'InfoFilled' },
]

// API 设置
const apiSettings = ref({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5030',
  apiTimeout: 30000,
  apiRetryCount: 3,
  apiRetryDelay: 1000,
  enableDebug: false,
})

// 外观设置
const appearanceSettings = ref({
  theme: appStore.isDark ? 'dark' : 'light',
  language: 'zh-CN',
  fontSize: 'medium',
})

// 通知设置
const notificationSettings = ref({
  enableNotifications: true,
  enableMention: true,
  enableQuote: true,
  enableMessage: false,
  enableSound: true,
  enableVibrate: false,
  onlyShowLatest: true,
  autoCloseTime: 5,
  myWxid: '',
  showMessageContent: true,
})

// 聊天设置
const chatSettings = ref({
  showTimestamp: true,
  showAvatar: true,
  messageGrouping: true,
  showMediaResources: true,
  enableServerPinning: true,
  autoRefresh: false,
  autoRefreshInterval: 30,
})

// 隐私设置
const privacySettings = ref({
  saveHistory: true,
  autoDownloadMedia: true,
  compressImages: true,
})

// 高级设置
const advancedSettings = ref({
  enableDebug: false,
  cacheSize: '100MB',
})

// 版本信息
const versionInfo = computed(() => {
  const info = getVersionInfo()
  return {
    version: info.version || getVersion(),
    buildDate: info.buildDate || getBuildDate(),
    gitHash: info.gitHash,
    gitBranch: info.gitBranch,
    buildTime: info.buildTime,
    isDev: info.isDev,
  }
})

// 通知统计
const notificationStats = computed(() => notificationStore.getStats())

// 从 localStorage 加载配置
const loadSettings = () => {
  try {
    // 优先从独立的 apiBaseUrl key 加载
    const directApiUrl = localStorage.getItem('apiBaseUrl')
    if (directApiUrl) {
      apiSettings.value.apiBaseUrl = directApiUrl
    }

    const savedSettings = localStorage.getItem('chatlog-settings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)

      // API 设置
      if (!directApiUrl && parsed.apiBaseUrl !== undefined) {
        apiSettings.value.apiBaseUrl = parsed.apiBaseUrl
      }
      if (parsed.apiTimeout !== undefined) apiSettings.value.apiTimeout = parsed.apiTimeout
      if (parsed.apiRetryCount !== undefined) apiSettings.value.apiRetryCount = parsed.apiRetryCount
      if (parsed.apiRetryDelay !== undefined) apiSettings.value.apiRetryDelay = parsed.apiRetryDelay
      if (parsed.enableDebug !== undefined) {
        apiSettings.value.enableDebug = parsed.enableDebug
        advancedSettings.value.enableDebug = parsed.enableDebug
        appStore.config.enableDebug = parsed.enableDebug
      }

      // 外观设置
      if (parsed.theme !== undefined) appearanceSettings.value.theme = parsed.theme
      if (parsed.language !== undefined) appearanceSettings.value.language = parsed.language
      if (parsed.fontSize !== undefined) appearanceSettings.value.fontSize = parsed.fontSize

      // 通知设置
      if (parsed.enableNotifications !== undefined)
        notificationSettings.value.enableNotifications = parsed.enableNotifications
      if (parsed.enableMention !== undefined)
        notificationSettings.value.enableMention = parsed.enableMention
      if (parsed.enableQuote !== undefined)
        notificationSettings.value.enableQuote = parsed.enableQuote
      if (parsed.enableMessage !== undefined)
        notificationSettings.value.enableMessage = parsed.enableMessage
      if (parsed.enableSound !== undefined)
        notificationSettings.value.enableSound = parsed.enableSound
      if (parsed.enableVibrate !== undefined)
        notificationSettings.value.enableVibrate = parsed.enableVibrate
      if (parsed.onlyShowLatest !== undefined)
        notificationSettings.value.onlyShowLatest = parsed.onlyShowLatest
      if (parsed.autoCloseTime !== undefined)
        notificationSettings.value.autoCloseTime = parsed.autoCloseTime
      if (parsed.myWxid !== undefined) notificationSettings.value.myWxid = parsed.myWxid
      if (parsed.showMessageContent !== undefined)
        notificationSettings.value.showMessageContent = parsed.showMessageContent

      // 聊天设置
      if (parsed.showTimestamp !== undefined)
        chatSettings.value.showTimestamp = parsed.showTimestamp
      if (parsed.showAvatar !== undefined) chatSettings.value.showAvatar = parsed.showAvatar
      if (parsed.messageGrouping !== undefined)
        chatSettings.value.messageGrouping = parsed.messageGrouping
      if (parsed.showMediaResources !== undefined)
        chatSettings.value.showMediaResources = parsed.showMediaResources
      if (parsed.enableServerPinning !== undefined)
        chatSettings.value.enableServerPinning = parsed.enableServerPinning
      if (parsed.autoRefresh !== undefined) chatSettings.value.autoRefresh = parsed.autoRefresh
      if (parsed.autoRefreshInterval !== undefined)
        chatSettings.value.autoRefreshInterval = parsed.autoRefreshInterval

      // 隐私设置
      if (parsed.saveHistory !== undefined) privacySettings.value.saveHistory = parsed.saveHistory
      if (parsed.autoDownloadMedia !== undefined)
        privacySettings.value.autoDownloadMedia = parsed.autoDownloadMedia
      if (parsed.compressImages !== undefined)
        privacySettings.value.compressImages = parsed.compressImages

      // 高级设置
      if (parsed.cacheSize !== undefined) advancedSettings.value.cacheSize = parsed.cacheSize

      console.log('[Settings] 已加载保存的配置')
    }
  } catch (error) {
    console.error('[Settings] 加载配置失败:', error)
    ElMessage.warning('加载配置失败，使用默认配置')
  }
}

// 同步通知设置到 Store
const syncNotificationSettings = () => {
  notificationStore.updateConfig({
    enabled: notificationSettings.value.enableNotifications,
    enableMention: notificationSettings.value.enableMention,
    enableQuote: notificationSettings.value.enableQuote,
    enableMessage: notificationSettings.value.enableMessage,
    enableSound: notificationSettings.value.enableSound,
    enableVibrate: notificationSettings.value.enableVibrate,
    onlyShowLatest: notificationSettings.value.onlyShowLatest,
    autoClose: notificationSettings.value.autoCloseTime,
    myWxid: notificationSettings.value.myWxid,
    showMessageContent: notificationSettings.value.showMessageContent,
  })
}

// 组件挂载时加载配置
onMounted(async () => {
  loadSettings()
  // 初始化通知 Store
  await notificationStore.init()
  // 初始化 LLM Config Store
  await llmConfigStore.init()
  // 从 notificationStore 加载设置
  notificationSettings.value.myWxid = notificationStore.config.myWxid || ''
  notificationSettings.value.showMessageContent = notificationStore.config.showMessageContent
  // 同步通知设置
  syncNotificationSettings()
})

// 处理主题变化
const handleThemeChange = (theme: string) => {
  appStore.updateSettings({ theme: theme as 'light' | 'dark' | 'auto' })
  ElMessage.success('主题已切换')
}

// 处理 API 设置更新
const handleApiSettingsUpdate = (newSettings: typeof apiSettings.value) => {
  apiSettings.value = newSettings
  // 同步 enableDebug 到高级设置和 appStore
  advancedSettings.value.enableDebug = newSettings.enableDebug
  appStore.config.enableDebug = newSettings.enableDebug
}

// 处理高级设置更新
const handleAdvancedSettingsUpdate = (newSettings: typeof advancedSettings.value) => {
  advancedSettings.value = newSettings
  // 同步 enableDebug 到 API 设置和 appStore
  apiSettings.value.enableDebug = newSettings.enableDebug
  appStore.config.enableDebug = newSettings.enableDebug
}

// 清空通知历史
const handleClearNotificationHistory = () => {
  notificationStore.clearHistory()
  ElMessage.success('通知历史已清空')
}

// 导出数据
const handleExportData = async () => {
  try {
    // 选择导出格式
    const result = await ElMessageBox.prompt('选择导出格式', '导出数据', {
      confirmButtonText: '导出',
      cancelButtonText: '取消',
      inputPattern: /^(json|csv|txt|markdown)$/,
      inputErrorMessage: '请选择有效的格式: json, csv, txt, markdown',
      inputPlaceholder: 'json',
      inputValue: 'json',
    }).catch(() => null)

    if (!result) return
    const format = result.value as string

    // 显示导出中提示
    const loading = ElLoading.service({
      lock: true,
      text: '正在导出数据...',
      background: 'rgba(0, 0, 0, 0.7)',
    })

    try {
      // 从 IndexedDB 获取所有会话数据
      const sessionStore = useSessionStore()
      const sessions = sessionStore.sessions

      if (sessions.length === 0) {
        ElMessage.warning('没有可导出的会话数据')
        return
      }

      // 导出所有会话的消息
      const exportData: Record<string, any> = {
        exportTime: new Date().toISOString(),
        sessions: [],
      }

      for (const session of sessions.slice(0, 10)) {
        // 限制导出前10个会话避免超时
        try {
          const messages = await chatlogAPI.getChatlog({
            talker: session.id,
            time: '',
            limit: 1000, // 每个会话最多导出1000条
          })

          exportData.sessions.push({
            sessionId: session.id,
            sessionName: session.name || session.talkerName,
            messageCount: messages.length,
            messages: messages,
          })
        } catch (err) {
          console.error(`导出会话 ${session.id} 失败:`, err)
        }
      }

      // 根据格式导出
      const timestamp = new Date().toISOString().split('T')[0]
      switch (format) {
        case 'json':
          downloadJSON(exportData, `chatlog_backup_${timestamp}`)
          break
        case 'txt':
          const textContent = formatBackupAsText(exportData)
          downloadText(textContent, `chatlog_backup_${timestamp}`)
          break
        case 'markdown':
          const markdownContent = formatBackupAsMarkdown(exportData)
          downloadMarkdown(markdownContent, `chatlog_backup_${timestamp}`)
          break
        case 'csv':
          // CSV 格式需要特殊处理，这里简化为导出第一个会话
          if (exportData.sessions.length > 0) {
            await chatlogAPI.exportCSV(
              { talker: exportData.sessions[0].sessionId, time: '', limit: 1000 },
              `chatlog_backup_${timestamp}.csv`
            )
          }
          break
      }

      ElMessage.success(`成功导出 ${exportData.sessions.length} 个会话的数据`)
    } finally {
      loading.close()
    }
  } catch (error) {
    console.error('导出数据失败:', error)
    ElMessage.error('导出失败，请重试')
  }
}

// 格式化备份数据为文本
const formatBackupAsText = (data: any): string => {
  const lines: string[] = []
  lines.push(`备份时间: ${data.exportTime}`)
  lines.push(`会话数量: ${data.sessions.length}`)
  lines.push('='.repeat(50))

  for (const session of data.sessions) {
    lines.push(`\n【${session.sessionName}】(${session.messageCount} 条消息)`)
    lines.push('-'.repeat(50))

    for (const msg of session.messages) {
      const time = new Date(msg.time).toLocaleString('zh-CN')
      const sender = msg.senderName || msg.sender
      const content = msg.content || '[非文本消息]'
      lines.push(`[${time}] ${sender}: ${content}`)
    }
  }

  return lines.join('\n')
}

// 格式化备份数据为 Markdown
const formatBackupAsMarkdown = (data: any): string => {
  const lines: string[] = []
  lines.push(`# Chatlog Session 数据备份`)
  lines.push('')
  lines.push(`**备份时间:** ${data.exportTime}`)
  lines.push(`**会话数量:** ${data.sessions.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const session of data.sessions) {
    lines.push(`## ${session.sessionName}`)
    lines.push('')
    lines.push(`**消息数量:** ${session.messageCount}`)
    lines.push('')

    for (const msg of session.messages) {
      const time = new Date(msg.time).toLocaleString('zh-CN')
      const sender = msg.senderName || msg.sender
      const content = msg.content || '[非文本消息]'

      lines.push(`**${sender}** *${time}*`)
      lines.push('')
      lines.push(content)
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}

// 清除缓存
const handleClearCache = async () => {
  // 清除缓存
  localStorage.clear()
  sessionStorage.clear()
  ElMessage.success('缓存已清除')
}

// 检查更新
const handleCheckUpdate = () => {
  ElMessage.info('当前已是最新版本')
}

// 重新运行引导
const handleRestartOnboarding = async () => {
  // 清除引导完成标记
  localStorage.removeItem('onboardingCompleted')
  localStorage.removeItem('onboardingSkippedAt')

  ElMessage.success('即将打开引导页面')

  // 跳转到引导页面
  setTimeout(() => {
    router.push('/onboarding')
  }, 500)
}

// 保存设置
const saveSettings = () => {
  // 自动去除 apiBaseUrl 末尾的斜杠
  if (apiSettings.value.apiBaseUrl.endsWith('/')) {
    apiSettings.value.apiBaseUrl = apiSettings.value.apiBaseUrl.slice(0, -1)
  }

  // 保存 apiBaseUrl 到独立的 key
  localStorage.setItem('apiBaseUrl', apiSettings.value.apiBaseUrl)

  // 合并所有设置
  const allSettings = {
    ...apiSettings.value,
    ...appearanceSettings.value,
    ...notificationSettings.value,
    ...chatSettings.value,
    ...privacySettings.value,
    ...advancedSettings.value,
  }

  // 保存到 localStorage
  localStorage.setItem('chatlog-settings', JSON.stringify(allSettings))

  // 同步用户设置到 appStore
  appStore.updateSettings({
    showMediaResources: chatSettings.value.showMediaResources,
    disableServerPinning: !chatSettings.value.enableServerPinning,
  })

  // 同步通知设置到 notificationStore
  syncNotificationSettings()

  // 触发自定义事件
  window.dispatchEvent(
    new CustomEvent('chatlog-settings-updated', {
      detail: allSettings,
    })
  )

  ElMessage.success('设置已保存')
}

// 重置设置
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要重置所有设置吗？此操作不可恢复。', '重置设置', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })

    // 重置所有设置
    apiSettings.value = {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5030',
      apiTimeout: 30000,
      apiRetryCount: 3,
      apiRetryDelay: 1000,
      enableDebug: false,
    }

    appearanceSettings.value = {
      theme: 'light',
      language: 'zh-CN',
      fontSize: 'medium',
    }

    notificationSettings.value = {
      enableNotifications: true,
      enableMention: true,
      enableQuote: true,
      enableMessage: false,
      enableSound: true,
      enableVibrate: false,
      onlyShowLatest: true,
      autoCloseTime: 5,
      myWxid: '',
      showMessageContent: true,
    }

    chatSettings.value = {
      showTimestamp: true,
      showAvatar: true,
      messageGrouping: true,
      showMediaResources: true,
      enableServerPinning: true,
      autoRefresh: false,
      autoRefreshInterval: 30,
    }

    privacySettings.value = {
      saveHistory: true,
      autoDownloadMedia: true,
      compressImages: true,
    }

    advancedSettings.value = {
      enableDebug: false,
      cacheSize: '100MB',
    }

    appStore.config.enableDebug = false

    localStorage.removeItem('chatlog-settings')
    ElMessage.success('设置已重置')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-container">
      <!-- 侧边栏菜单 -->
      <div class="settings-sidebar">
        <div class="sidebar-header">
          <h2>设置</h2>
        </div>

        <el-menu
          :default-active="activeMenu"
          class="settings-menu"
          @select="(key: string) => (activeMenu = key)"
        >
          <el-menu-item v-for="item in menuItems" :key="item.key" :index="item.key">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 设置内容 -->
      <div class="settings-content">
        <el-scrollbar>
          <div class="settings-content-inner">
            <!-- API 设定 -->
            <ApiSettings
              v-show="activeMenu === 'api'"
              v-model="apiSettings"
              @update:model-value="handleApiSettingsUpdate"
            />

            <!-- AI 助手 -->
            <AiSettings v-show="activeMenu === 'ai'" />

            <!-- 外观设置 -->
            <AppearanceSettings
              v-show="activeMenu === 'appearance'"
              v-model="appearanceSettings"
              @theme-change="handleThemeChange"
            />

            <!-- 通知设置 -->
            <NotificationSettings
              v-show="activeMenu === 'notifications'"
              v-model="notificationSettings"
              :notification-stats="notificationStats"
              @clear-history="handleClearNotificationHistory"
            />

            <!-- 聊天设置 -->
            <ChatSettings v-show="activeMenu === 'chat'" v-model="chatSettings" />

            <!-- 隐私设置 -->
            <PrivacySettings
              v-show="activeMenu === 'privacy'"
              v-model="privacySettings"
              @export-data="handleExportData"
              @clear-cache="handleClearCache"
            />

            <!-- 高级设置 -->
            <AdvancedSettings
              v-show="activeMenu === 'advanced'"
              v-model="advancedSettings"
              @update:model-value="handleAdvancedSettingsUpdate"
            />

            <!-- 关于 -->
            <AboutSettings
              v-show="activeMenu === 'about'"
              :version-info="versionInfo"
              @check-update="handleCheckUpdate"
              @restart-onboarding="handleRestartOnboarding"
            />
          </div>
        </el-scrollbar>

        <!-- 底部操作栏 -->
        <div class="settings-footer">
          <el-button @click="resetSettings">重置设置</el-button>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  width: 100%;
  height: 100%;
  background-color: var(--el-bg-color);
  overflow: hidden;
}

.settings-container {
  display: flex;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

// 侧边栏
.settings-sidebar {
  width: 240px;
  height: 100%;
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    align-items: center;
    gap: 8px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .settings-menu {
    flex: 1;
    border-right: none;
    overflow-y: auto;
  }
}

// 内容区域
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;

  .settings-content-inner {
    padding: 24px 32px;
    min-height: 100%;
  }
}

// 底部操作栏
.settings-footer {
  padding: 16px 32px;
  border-top: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-bg-color-page);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

// 响应式设计
@media (max-width: 768px) {
  .settings-container {
    flex-direction: column;
  }

  .settings-sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-light);

    .settings-menu {
      display: flex;
      overflow-x: auto;
      overflow-y: hidden;

      :deep(.el-menu-item) {
        flex-shrink: 0;
      }
    }
  }

  .settings-content {
    .settings-content-inner {
      padding: 16px;
    }
  }

  .settings-footer {
    padding: 12px 16px;
  }
}
</style>
