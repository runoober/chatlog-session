<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useContactStore } from '@/stores/contact'
import { useChatroomStore } from '@/stores/chatroom'
import { useDisplayName } from '@/components/chat/composables/useDisplayName'
import MobileNavBar from '@/components/layout/MobileNavBar.vue'
import Avatar from '@/components/common/Avatar.vue'
import type { Contact } from '@/types'
import type { Chatroom, ChatroomMember } from '@/types/contact'
import { ContactType } from '@/types/contact'
import type { Session } from '@/types/session'

interface Props {
  contactId?: string
  session?: Session
  hideNavBar?: boolean
}

const props = defineProps<Props>()

const appStore = useAppStore()
const contactStore = useContactStore()
const chatroomStore = useChatroomStore()

// 当前联系人
const contact = ref<Contact | null>(null)

// 群聊详情
const chatroomDetail = ref<Chatroom | null>(null)
const chatroomLoading = ref(false)

// 群主显示名称
const { displayName: ownerDisplayName } = useDisplayName({
  id: computed(() => chatroomDetail.value?.owner),
  defaultName: computed(() => chatroomDetail.value?.owner),
})

// 加载联系人详情
const loadContact = async () => {
  console.log('🔍 ContactDetail.loadContact')
  console.log('props.contactId:', props.contactId)
  console.log('props.session:', props.session)
  console.log('contactStore.contacts 数量:', contactStore.contacts.length)
  
  if (props.contactId) {
    contact.value = contactStore.contacts.find(c => c.wxid === props.contactId) || null
    console.log('找到的 contact:', contact.value)
    
    // 如果没找到联系人，尝试从 API 加载
    if (!contact.value) {
      console.log('⚠️ 在 contactStore.contacts 中未找到联系人，尝试从 store 加载')
      try {
        // 尝试通过 contactStore 获取联系人
        await contactStore.loadContacts()
        contact.value = contactStore.contacts.find(c => c.wxid === props.contactId) || null
        console.log('重新加载后找到的 contact:', contact.value)
      } catch (err) {
        console.error('加载联系人失败:', err)
      }
    }
    
    // 如果还是没找到，但有 session 数据，从 session 构造联系人
    if (!contact.value && props.session) {
      console.log('📝 从 session 数据构造联系人')
      contact.value = {
        wxid: props.contactId,
        nickname: props.session.talkerName || props.session.name || props.contactId,
        remark: props.session.remark || props.session.name || '',
        alias: '',
        avatar: props.session.avatar || '',
        type: (props.session.type === 'group' ? ContactType.Chatroom : 
              props.session.type === 'official' ? ContactType.Official : ContactType.Friend) as ContactType,
        isStarred: props.session.isPinned || false,
        gender: 0,
        province: '',
        city: '',
        signature: ''
      }
      console.log('构造的 contact:', contact.value)
    }
    
    // 如果是群聊，加载群聊详情
    if (contact.value && contact.value.type === 'chatroom') {
      await loadChatroomDetail()
    } else {
      chatroomDetail.value = null
    }
  }
}

// 加载群聊详情
const loadChatroomDetail = async () => {
  if (!props.contactId) return
  
  chatroomLoading.value = true
  try {
    chatroomDetail.value = await chatroomStore.getChatroomDetail(props.contactId)
    // 加载成员显示名称
    await loadMemberDisplayNames()
  } catch (err) {
    console.error('加载群聊详情失败:', err)
    chatroomDetail.value = null
  } finally {
    chatroomLoading.value = false
  }
}

// 监听 contactId 或 session 变化
watch(() => [props.contactId, props.session], () => {
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

// 是否为群聊
const isChatroom = computed(() => contact.value?.type === 'chatroom')

// 群成员显示列表（最多显示前10个）
const displayMembers = computed(() => {
  if (!chatroomDetail.value?.members) return []
  return chatroomDetail.value.members.slice(0, 10)
})

// 剩余成员数量
const remainingMemberCount = computed(() => {
  if (!chatroomDetail.value?.members) return 0
  const total = chatroomDetail.value.members.length
  return total > 10 ? total - 10 : 0
})

// 获取成员显示名称（使用 contactStore）
const getMemberDisplayName = async (wxid: string) => {
  try {
    const name = await contactStore.getContactDisplayName(wxid)
    return name || wxid
  } catch (err) {
    console.warn('获取成员显示名称失败:', wxid, err)
    return wxid
  }
}

// 成员显示名称映射
const memberDisplayNames = ref<Map<string, string>>(new Map())

// 加载成员显示名称
const loadMemberDisplayNames = async () => {
  if (!chatroomDetail.value?.members) return
  
  memberDisplayNames.value.clear()
  
  // 批量获取成员显示名称
  const promises = chatroomDetail.value.members.slice(0, 10).map(async (member) => {
    const name = await getMemberDisplayName(member.wxid)
    memberDisplayNames.value.set(member.wxid, name)
  })
  
  await Promise.all(promises)
}

// 获取成员显示名称（同步）
const getMemberDisplayNameSync = (member: ChatroomMember) => {
  return memberDisplayNames.value.get(member.wxid) || 
         member.displayName || 
         member.nickname || 
         member.wxid
}

// 刷新群聊详情
const refreshChatroomDetail = async () => {
  if (!props.contactId) return
  await chatroomStore.getChatroomDetail(props.contactId, false)
  await loadChatroomDetail()
  await loadMemberDisplayNames()
}
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

      <!-- 群聊详细信息 -->
      <div v-if="isChatroom" class="chatroom-section">
        <div class="section-header">
          <h3 class="section-title">群聊信息</h3>
          <el-button 
            v-if="chatroomDetail"
            text 
            type="primary" 
            size="small"
            :loading="chatroomLoading"
            @click="refreshChatroomDetail"
          >
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <div v-if="chatroomLoading" class="chatroom-loading">
          <el-skeleton :rows="3" animated />
        </div>

        <div v-else-if="chatroomDetail" class="detail-list">
          <div class="detail-item">
            <div class="detail-item__label">群聊名称</div>
            <div class="detail-item__value">{{ chatroomDetail.name || '-' }}</div>
          </div>

          <div class="detail-item">
            <div class="detail-item__label">群主</div>
            <div class="detail-item__value">{{ ownerDisplayName || chatroomDetail.owner || '-' }}</div>
          </div>

          <div class="detail-item">
            <div class="detail-item__label">成员数量</div>
            <div class="detail-item__value">
              <el-tag type="success" size="small">
                {{ chatroomDetail.memberCount }} 人
              </el-tag>
            </div>
          </div>

          <div v-if="chatroomDetail.members && chatroomDetail.members.length > 0" class="detail-item members-item">
            <div class="detail-item__label">群成员</div>
            <div class="detail-item__value">
              <div class="members-list">
                <el-tag
                  v-for="member in displayMembers"
                  :key="member.wxid"
                  size="small"
                  class="member-tag"
                  :type="member.wxid === chatroomDetail.owner ? 'warning' : 'info'"
                >
                  {{ getMemberDisplayNameSync(member) }}
                  <span v-if="member.wxid === chatroomDetail.owner" class="owner-badge">群主</span>
                </el-tag>
                <el-tag v-if="remainingMemberCount > 0" size="small" type="info" class="member-tag">
                  +{{ remainingMemberCount }} 人
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="chatroom-empty">
          <el-empty 
            description="未找到群聊详情" 
            :image-size="60"
          >
            <el-button type="primary" size="small" @click="loadChatroomDetail">
              重新加载
            </el-button>
          </el-empty>
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

  &.members-item {
    align-items: flex-start;

    .detail-item__value {
      display: flex;
      flex-direction: column;
    }
  }
}

// 群聊信息区域
.chatroom-section {
  margin-top: 16px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
  }
}

.chatroom-loading {
  padding: 16px;
}

.chatroom-empty {
  padding: 24px 16px;
}

// 成员列表
.members-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .member-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;

    .owner-badge {
      font-size: 12px;
      opacity: 0.8;
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

  .chatroom-section {
    margin-top: 12px;
    padding: 12px;
  }

  .section-header {
    .section-title {
      font-size: 14px;
    }
  }

  .members-list {
    .member-tag {
      font-size: 12px;
    }
  }
}
</style>
