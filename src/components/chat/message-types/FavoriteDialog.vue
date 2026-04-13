<script setup lang="ts">
import { computed } from 'vue'
import Avatar from '@/components/common/Avatar.vue'
import { MessageIconMap, MessageTypeMap } from '@/types/message'
import { formatFileSize } from '../composables/utils'

interface FavoriteDataItem {
  DataType: string
  DataID?: string
  DataFmt?: string
  SourceName?: string
  SourceTime?: string
  SourceHeadURL?: string
  DataDesc?: string
  DataTitle?: string
  DataSize?: string
  ThumbSize?: string
  FullMD5?: string
  Link?: string
  HTMLID?: string
  Location?: {
    Label?: string
    PoiName?: string
    Lat?: string
    Lng?: string
  }
}

interface Props {
  visible: boolean
  title: string
  items: FavoriteDataItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const getMessageTypeLabel = (dataType: string): string => {
  const typeMap: Record<string, string> = {
    '1': '文本',
    '2': '图片',
    '3': '图片',
    '4': '视频',
    '5': '视频',
    '6': '位置',
    '8': '文件',
    '34': '语音',
    '43': '视频',
    '48': '位置',
  }
  return typeMap[dataType] || MessageTypeMap[dataType] || '未知消息'
}

const getMessageIcon = (dataType: string): string => {
  const iconMap: Record<string, string> = {
    '1': 'ChatLineSquare',
    '2': 'Picture',
    '3': 'Picture',
    '4': 'VideoPlay',
    '5': 'VideoPlay',
    '6': 'Location',
    '8': 'Document',
    '34': 'Microphone',
    '43': 'VideoPlay',
    '48': 'Location',
  }
  return iconMap[dataType] || MessageIconMap[dataType] || 'QuestionFilled'
}

const hasSourceMeta = (item: FavoriteDataItem): boolean => {
  return Boolean(item.SourceName || item.SourceTime || item.SourceHeadURL)
}

const getImageUrl = (item: FavoriteDataItem): string => {
  if (!item.FullMD5) return ''
  const apiBaseUrl = localStorage.getItem('apiBaseUrl') || 'http://127.0.0.1:5030'
  return `${apiBaseUrl}/image/${item.FullMD5}`
}

const getThumbnailUrl = (item: FavoriteDataItem): string => {
  if (!item.FullMD5) return ''
  const apiBaseUrl = localStorage.getItem('apiBaseUrl') || 'http://127.0.0.1:5030'
  return `${apiBaseUrl}/image/${item.FullMD5}?thumbnail=true`
}

const isFavoriteNoteFile = (item: FavoriteDataItem): boolean => {
  return item.DataType === '8' && (item.DataFmt === 'htm' || item.HTMLID === 'WeNoteHtmlFile')
}
</script>

<template>
  <el-dialog v-model="dialogVisible" :title="title" width="600px" :close-on-click-modal="true">
    <div class="favorite-dialog">
      <div v-if="items.length > 0" class="favorite-list">
        <div v-for="(item, index) in items" :key="item.DataID || index" class="favorite-item">
          <div v-if="hasSourceMeta(item)" class="favorite-item-header">
            <Avatar :src="item.SourceHeadURL" :name="item.SourceName" :size="36" />
            <div class="favorite-item-info">
              <div class="favorite-item-sender">{{ item.SourceName || '来源消息' }}</div>
              <div class="favorite-item-time">{{ item.SourceTime }}</div>
            </div>
          </div>

          <div
            class="favorite-item-content"
            :class="{ 'favorite-item-content--no-header': !hasSourceMeta(item) }"
          >
            <div v-if="item.DataType === '1'" class="favorite-text">
              {{ item.DataDesc || item.DataTitle || '文本内容' }}
            </div>

            <div v-else-if="item.DataType === '2' || item.DataType === '3'" class="favorite-image">
              <el-image
                v-if="getThumbnailUrl(item)"
                :src="getThumbnailUrl(item)"
                :preview-src-list="[getImageUrl(item)]"
                fit="cover"
                class="image-preview"
                lazy
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                    <span>图片</span>
                  </div>
                </template>
              </el-image>
              <div v-else class="favorite-media-placeholder">
                <el-icon><Picture /></el-icon>
                <span>[图片]</span>
              </div>
              <div v-if="item.DataSize || item.ThumbSize" class="image-info">
                {{ formatFileSize(parseInt(item.DataSize || item.ThumbSize || '0')) }}
              </div>
            </div>

            <div v-else-if="item.DataType === '34'" class="favorite-voice">
              <el-icon class="voice-icon"><Microphone /></el-icon>
              <div class="voice-info">
                <span>[语音]</span>
                <span v-if="item.DataSize" class="media-size">
                  {{ formatFileSize(parseInt(item.DataSize)) }}
                </span>
              </div>
            </div>

            <div
              v-else-if="item.DataType === '4' || item.DataType === '5' || item.DataType === '43'"
              class="favorite-video"
            >
              <div v-if="getThumbnailUrl(item)" class="video-thumbnail">
                <el-image
                  :src="getThumbnailUrl(item)"
                  :preview-src-list="[getImageUrl(item)]"
                  fit="cover"
                  lazy
                />
                <div class="video-play-icon">
                  <el-icon size="40"><VideoPlay /></el-icon>
                </div>
              </div>
              <div v-else class="video-placeholder">
                <el-icon class="video-icon"><VideoPlay /></el-icon>
                <div class="video-info">
                  <div class="video-title">{{ item.DataTitle || '[视频]' }}</div>
                  <span v-if="item.DataSize" class="media-size">
                    {{ formatFileSize(parseInt(item.DataSize)) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else-if="item.DataType === '8'" class="favorite-file">
              <el-icon class="file-icon"><Document /></el-icon>
              <div class="file-details">
                <div class="file-name">
                  {{ item.DataTitle || '未命名文件' }}
                  <span v-if="item.DataFmt" class="file-format">.{{ item.DataFmt }}</span>
                </div>
                <div class="file-meta">
                  <span class="file-kind">{{
                    isFavoriteNoteFile(item) ? '收藏笔记' : '文件内容'
                  }}</span>
                  <span v-if="item.DataSize" class="file-size">
                    {{ formatFileSize(parseInt(item.DataSize)) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-else-if="item.DataType === '6' || item.DataType === '48'"
              class="favorite-location"
            >
              <el-icon class="location-icon"><Location /></el-icon>
              <div class="location-info">
                <div class="location-label">
                  {{ item.DataTitle || item.Location?.Label || item.Location?.PoiName || '[位置]' }}
                </div>
                <div v-if="item.Location?.Lat && item.Location?.Lng" class="location-coords">
                  {{ item.Location.Lat }}, {{ item.Location.Lng }}
                </div>
              </div>
            </div>

            <div v-else-if="item.Link" class="favorite-link">
              <el-icon class="link-icon"><Link /></el-icon>
              <div class="link-info">
                <div class="link-title">{{ item.DataTitle || '链接' }}</div>
                <div v-if="item.DataDesc" class="link-desc">{{ item.DataDesc }}</div>
                <div class="link-url">{{ item.Link }}</div>
              </div>
            </div>

            <div v-else class="favorite-other">
              <el-icon class="other-icon">
                <component :is="getMessageIcon(item.DataType)" />
              </el-icon>
              <div class="other-info">
                <span class="type-label">[{{ getMessageTypeLabel(item.DataType) }}]</span>
                <span v-if="item.DataTitle" class="other-title">{{ item.DataTitle }}</span>
                <span v-else-if="item.DataDesc" class="other-desc">{{ item.DataDesc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-empty v-else description="暂无收藏内容" />
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.favorite-dialog {
  max-height: 500px;
  overflow-y: auto;

  .favorite-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .favorite-item {
    padding: 14px;
    background-color: var(--el-fill-color-lighter);
    border-radius: 8px;

    &-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    &-info {
      flex: 1;
      min-width: 0;
    }

    &-sender {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      margin-bottom: 2px;
    }

    &-time {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &-content {
      padding-left: 48px;
    }

    &-content--no-header {
      padding-left: 0;
    }
  }

  .favorite-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .favorite-image {
    .image-preview {
      width: 200px;
      height: 200px;
      border-radius: 8px;
      overflow: hidden;
    }

    .image-error,
    .favorite-media-placeholder {
      width: 200px;
      height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: var(--el-fill-color);
      color: var(--el-text-color-placeholder);
      border-radius: 8px;
    }

    .image-info {
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .favorite-voice,
  .favorite-file,
  .favorite-location,
  .favorite-link,
  .favorite-other,
  .video-placeholder {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: var(--el-fill-color);
    border-radius: 6px;
  }

  .favorite-video {
    .video-thumbnail {
      position: relative;
      width: 200px;
      height: 200px;
      border-radius: 8px;
      overflow: hidden;
    }

    .video-play-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: rgba(0, 0, 0, 0.25);
      pointer-events: none;
    }
  }

  .voice-icon,
  .file-icon,
  .location-icon,
  .link-icon,
  .other-icon,
  .video-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .file-details,
  .location-info,
  .link-info,
  .other-info,
  .voice-info,
  .video-info {
    min-width: 0;
    flex: 1;
  }

  .file-name,
  .location-label,
  .link-title,
  .video-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    word-break: break-word;
  }

  .file-meta,
  .location-coords,
  .link-url,
  .link-desc,
  .media-size,
  .file-kind,
  .file-size,
  .type-label,
  .other-desc,
  .other-title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
