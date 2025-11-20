<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useContactStore } from '@/stores/contact'
import MobileNavBar from '@/components/layout/MobileNavBar.vue'
import Avatar from '@/components/common/Avatar.vue'
import type { Contact } from '@/types'

interface Props {
  contactId?: string
}

const props = defineProps<Props>()

const appStore = useAppStore()
const contactStore = useContactStore()

// 当前联系人
const contact = ref<Contact | null>(null)

// 加载联系人详情
const loadContact = () => {
  if (props.contactId) {
    contact.value = contactStore.contacts.find(c => c.wxid === props.contactId) || null
  }
}

// 监听 contactId 变化
watch(() => props.contactId, () => {
  loadContact()
}, { immediate: true })

// 返回
const handleBack = () => {
  appStore.navigateBack()
}

// 格式化性别
const genderText = computed(() => {
  if (!contact.value) return '未知'
  switch (contact.value.gender) {
    case 1:
      return '男'
    case 2:
      return '女'
    default:
      return '未知'
  }
})

// 格式化类型
const typeText = computed(() => {
  if (!contact.value) return '未知'
  switch (contact.value.type) {
    case 'friend':
      return '好友'
    case 'chatroom':
      return '群聊'
    case 'official':
      return '公众号'
    default:
      return '未知'
  }
})
</script>

<template>
  <div class="contact-detail-page">
    <!-- 移动端顶部导航栏 -->
    <MobileNavBar
      v-if="appStore.isMobile"
      :title="contact?.remark || contact?.nickname || '联系人详情'"
      :show-back="true"
      @back="handleBack"
    />

    <div v-if="contact" class="contact-detail-content">
      <!-- 头像和基本信息 -->
      <div class="detail-header">
        <Avatar
          :src="contact.avatar"
          :name="contact.nickname"
          :size="80"
          class="detail-avatar"
        />
        <div class="detail-info">
          <h2 class="detail-name">
            {{ contact.remark || contact.nickname }}
          </h2>
          <div class="detail-meta">
            <el-tag size="small" type="info">{{ typeText }}</el-tag>
            <el-tag v-if="contact.isStarred" size="small" type="warning">
              <el-icon><Star /></el-icon>
              星标
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 详细信息列表 -->
      <div class="detail-list">
        <div class="detail-item">
          <div class="detail-item__label">微信号</div>
          <div class="detail-item__value">{{ contact.wxid || '-' }}</div>
        </div>

        <div v-if="contact.remark && contact.remark !== contact.nickname" class="detail-item">
          <div class="detail-item__label">昵称</div>
          <div class="detail-item__value">{{ contact.nickname || '-' }}</div>
        </div>

        <div v-if="contact.alias" class="detail-item">
          <div class="detail-item__label">账号</div>
          <div class="detail-item__value">{{ contact.alias }}</div>
        </div>

        <div class="detail-item">
          <div class="detail-item__label">性别</div>
          <div class="detail-item__value">{{ genderText }}</div>
        </div>

        <div v-if="contact.province || contact.city" class="detail-item">
          <div class="detail-item__label">地区</div>
          <div class="detail-item__value">
            {{ [contact.province, contact.city].filter(Boolean).join(' ') || '-' }}
          </div>
        </div>

        <div v-if="contact.signature" class="detail-item">
          <div class="detail-item__label">个性签名</div>
          <div class="detail-item__value">{{ contact.signature }}</div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="contact-detail-empty">
      <el-empty description="未找到联系人信息" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.contact-detail-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  overflow: hidden;
}

.contact-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color-light);
    border-radius: 3px;
  }
}

// 头部
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  margin-bottom: 16px;

  .detail-avatar {
    flex-shrink: 0;
  }

  .detail-info {
    flex: 1;
    min-width: 0;
  }

  .detail-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 8px 0;
    word-break: break-all;
  }

  .detail-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

// 详情列表
.detail-list {
  background: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }

  &__label {
    width: 100px;
    flex-shrink: 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }

  &__value {
    flex: 1;
    font-size: 14px;
    color: var(--el-text-color-primary);
    line-height: 1.5;
    word-break: break-all;

    &.signature {
      font-style: italic;
      color: var(--el-text-color-regular);
    }
  }
}

// 空状态
.contact-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 移动端适配
@media (max-width: 768px) {
  .contact-detail-content {
    padding: 12px;
  }

  .detail-header {
    padding: 16px 12px;
    margin-bottom: 12px;

    .detail-name {
      font-size: 18px;
    }
  }

  .detail-item {
    padding: 12px;
    flex-direction: column;
    gap: 4px;

    &__label {
      width: auto;
      font-weight: 600;
    }

    &__value {
      padding-left: 0;
    }
  }
}
</style>
