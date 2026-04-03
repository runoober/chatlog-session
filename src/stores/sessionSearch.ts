/**
 * 会话搜索索引、匹配、排序与缓存补全
 *
 * 从 session store 中抽离，避免单个文件过大。
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { pinyin } from 'pinyin-pro'
import { chatroomAPI, contactAPI } from '@/api'
import type { Session } from '@/types/session'
import type { Chatroom, Contact } from '@/types/contact'
import { db } from '@/utils/db'

// ==================== Types ====================

export type SessionSearchMatchType =
  | 'displayName'
  | 'remark'
  | 'nickname'
  | 'alias'
  | 'talker'
  | 'message'
  | 'pinyin'

export interface SessionSearchMetadata {
  displayName: string
  remark: string
  nickname: string
  alias: string
  sessionName: string
  talkerName: string
  talker: string
  lastMessagePreview: string
  pinyinFull: string
  pinyinInitials: string
  matchedBy?: SessionSearchMatchType
  matchedText?: string
  matchScore?: number
}

interface SearchCandidate {
  type: SessionSearchMatchType
  value: string
  score: number
}

// ==================== Pure Utilities ====================

function normalizeSearchText(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

function buildPinyinFields(...values: string[]): { full: string; initials: string } {
  const source = values.filter(Boolean).join(' ').trim()

  if (!source) {
    return { full: '', initials: '' }
  }

  try {
    const full = pinyin(source, { toneType: 'none' }).replace(/\s+/g, '').toLowerCase()
    const initials = pinyin(source, { toneType: 'none', pattern: 'first' })
      .replace(/\s+/g, '')
      .toLowerCase()

    return { full, initials }
  } catch {
    return { full: '', initials: '' }
  }
}

function buildLastMessagePreview(session: Session): string {
  const message = session.lastMessage
  if (!message) {
    return ''
  }

  const content = message.content || '[非文本消息]'
  return message.nickName ? `${message.nickName}: ${content}` : content
}

function getFieldMatchScore(
  value: string,
  keyword: string,
  includeScore: number,
  prefixBonus = 80,
  exactBonus = 160
): number {
  const normalizedValue = normalizeSearchText(value)
  if (!normalizedValue || !keyword) {
    return 0
  }

  if (normalizedValue === keyword) {
    return includeScore + exactBonus
  }

  if (normalizedValue.startsWith(keyword)) {
    return includeScore + prefixBonus
  }

  if (normalizedValue.includes(keyword)) {
    return includeScore
  }

  return 0
}

// ==================== Factory ====================

export interface UseSessionSearchOptions {
  sessions: Ref<Session[]>
  searchKeyword: Ref<string>
  filterType: Ref<string>
  sortBy: Ref<'time' | 'name' | 'unread'>
  sortOrder: Ref<'asc' | 'desc'>
  contactMap: ComputedRef<Map<string, Contact>>
  disableServerPinning: ComputedRef<boolean>
}

export function useSessionSearch(options: UseSessionSearchOptions) {
  const {
    sessions,
    searchKeyword,
    filterType,
    sortBy,
    sortOrder,
    contactMap,
    disableServerPinning,
  } = options

  // ==================== State ====================

  const searchContacts = ref<Record<string, Contact>>({})
  const searchChatrooms = ref<Record<string, Chatroom>>({})
  const searchContextLoading = ref(false)
  const hydratingChatroomTalkers = new Set<string>()

  // ==================== Computed ====================

  const isSearchMode = computed(() => !!normalizeSearchText(searchKeyword.value))
  const searchKeywordNormalized = computed(() => normalizeSearchText(searchKeyword.value))

  function getSearchContact(session: Session): Contact | null {
    return contactMap.value.get(session.talker) || searchContacts.value[session.talker] || null
  }

  function getSearchChatroom(session: Session): Chatroom | null {
    if (session.type !== 'group') {
      return null
    }

    return searchChatrooms.value[session.talker] || null
  }

  function buildSessionSearchMetadata(session: Session): SessionSearchMetadata {
    const contact = getSearchContact(session)
    const chatroom = getSearchChatroom(session)
    const displayName =
      session.type === 'group'
        ? chatroom?.name || session.name || session.talkerName || session.talker
        : contact
          ? contactAPI.getDisplayName(contact)
          : session.remark || session.name || session.talkerName || session.talker
    const remark = session.type === 'group' ? '' : contact?.remark || session.remark || ''
    const nickname =
      session.type === 'group'
        ? chatroom?.name || session.name || session.talkerName || ''
        : contact?.nickname || session.talkerName || session.name || ''
    const alias = session.type === 'group' ? '' : contact?.alias || ''
    const sessionName = session.name || ''
    const talkerName = session.talkerName || ''
    const talker = session.talker || session.id
    const lastMessagePreview = buildLastMessagePreview(session)
    const { full, initials } = buildPinyinFields(displayName, remark, nickname)

    return {
      displayName,
      remark,
      nickname,
      alias,
      sessionName,
      talkerName,
      talker,
      lastMessagePreview,
      pinyinFull: full,
      pinyinInitials: initials,
    }
  }

  const sessionSearchMetadataMap = computed(() => {
    const map = new Map<string, SessionSearchMetadata>()
    sessions.value.forEach(session => {
      map.set(session.talker, buildSessionSearchMetadata(session))
    })
    return map
  })

  function getSessionSearchMetadata(session: Session | string): SessionSearchMetadata | undefined {
    const talker = typeof session === 'string' ? session : session.talker
    return sessionSearchMetadataMap.value.get(talker)
  }

  function compareSessionsBase(a: Session, b: Session): number {
    const aLocal = a.isLocalPinned ? 1 : 0
    const bLocal = b.isLocalPinned ? 1 : 0
    if (aLocal !== bLocal) return bLocal - aLocal

    if (!disableServerPinning.value) {
      const aPinned = a.isPinned ? 1 : 0
      const bPinned = b.isPinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
    }

    let compareValue = 0

    switch (sortBy.value) {
      case 'time':
        compareValue = (a.lastMessage?.createTime || 0) - (b.lastMessage?.createTime || 0)
        break
      case 'name': {
        const aName = getSessionSearchMetadata(a)?.displayName || a.name || a.talker
        const bName = getSessionSearchMetadata(b)?.displayName || b.name || b.talker
        compareValue = aName.localeCompare(bName, 'zh-CN')
        break
      }
      case 'unread':
        compareValue = (a.unreadCount || 0) - (b.unreadCount || 0)
        break
    }

    return sortOrder.value === 'desc' ? -compareValue : compareValue
  }

  function getSearchMatch(session: Session, keyword: string) {
    const metadata = getSessionSearchMetadata(session)
    if (!metadata) {
      return null
    }

    const candidates: SearchCandidate[] = [
      {
        type: 'displayName',
        value: metadata.displayName,
        score: getFieldMatchScore(metadata.displayName, keyword, 1000),
      },
      {
        type: 'remark',
        value: metadata.remark,
        score: getFieldMatchScore(metadata.remark, keyword, 920),
      },
      {
        type: 'nickname',
        value: metadata.nickname || metadata.talkerName || metadata.sessionName,
        score: getFieldMatchScore(
          metadata.nickname || metadata.talkerName || metadata.sessionName,
          keyword,
          860
        ),
      },
      {
        type: 'alias',
        value: metadata.alias,
        score: getFieldMatchScore(metadata.alias, keyword, 820),
      },
      {
        type: 'talker',
        value: metadata.talker,
        score: getFieldMatchScore(metadata.talker, keyword, 760),
      },
      {
        type: 'message',
        value: metadata.lastMessagePreview,
        score: getFieldMatchScore(metadata.lastMessagePreview, keyword, 680),
      },
      {
        type: 'pinyin',
        value: metadata.pinyinFull,
        score: getFieldMatchScore(metadata.pinyinFull, keyword, 620, 60, 120),
      },
      {
        type: 'pinyin',
        value: metadata.pinyinInitials,
        score: getFieldMatchScore(metadata.pinyinInitials, keyword, 580, 40, 80),
      },
    ]

    const best = candidates
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]

    if (!best) {
      return null
    }

    return {
      ...metadata,
      matchedBy: best.type,
      matchedText: best.type === 'pinyin' ? metadata.displayName : best.value,
      matchScore: best.score,
    }
  }

  const searchMatchesMap = computed(() => {
    const map = new Map<string, SessionSearchMetadata>()
    const keyword = searchKeywordNormalized.value

    if (!keyword) {
      return map
    }

    sessions.value.forEach(session => {
      const match = getSearchMatch(session, keyword)
      if (match) {
        map.set(session.talker, match)
      }
    })

    return map
  })

  const searchIndexIncomplete = computed(() => {
    return isSearchMode.value && searchContextLoading.value
  })

  function applySessionTypeFilter(source: Session[]) {
    if (filterType.value === 'all') {
      return source
    }

    if (filterType.value === 'chat') {
      return source.filter(session => session.type === 'private' || session.type === 'group')
    }

    return source.filter(session => session.type === filterType.value)
  }

  // ==================== Actions ====================

  async function hydrateSearchContacts(targetSessions: Session[]) {
    const contactTalkersToHydrate = [
      ...new Set(
        targetSessions
          .filter(session => session.type !== 'group')
          .map(session => session.talker)
          .filter(Boolean)
          .filter(talker => !contactMap.value.has(talker) && !searchContacts.value[talker])
      ),
    ]

    const chatroomTalkersToHydrate = [
      ...new Set(
        targetSessions
          .filter(session => session.type === 'group')
          .map(session => session.talker)
          .filter(Boolean)
          .filter(talker => !searchChatrooms.value[talker])
      ),
    ]

    if (contactTalkersToHydrate.length === 0 && chatroomTalkersToHydrate.length === 0) {
      return
    }

    searchContextLoading.value = true

    try {
      const contactEntries = await Promise.all(
        contactTalkersToHydrate.map(async talker => {
          const contact = await db.getContact(talker).catch(() => null)
          return [talker, contact] as const
        })
      )

      const chatroomEntries = await Promise.all(
        chatroomTalkersToHydrate.map(async talker => {
          const chatroom = await db.getChatroom(talker).catch(() => null)
          return [talker, chatroom] as const
        })
      )

      const missingChatroomTalkers = chatroomEntries
        .filter(([talker, chatroom]) => !chatroom && !hydratingChatroomTalkers.has(talker))
        .map(([talker]) => talker)

      if (missingChatroomTalkers.length > 0) {
        missingChatroomTalkers.forEach(talker => hydratingChatroomTalkers.add(talker))

        try {
          const fetchedChatrooms = await Promise.all(
            missingChatroomTalkers.map(async talker => {
              const chatroom = await chatroomAPI.getChatroomDetail(talker, true).catch(() => null)
              return [talker, chatroom] as const
            })
          )

          fetchedChatrooms.forEach(entry => {
            chatroomEntries.push(entry)
          })
        } finally {
          missingChatroomTalkers.forEach(talker => hydratingChatroomTalkers.delete(talker))
        }
      }

      const nextContacts = { ...searchContacts.value }
      const nextChatrooms = { ...searchChatrooms.value }
      let hasContactUpdate = false
      let hasChatroomUpdate = false

      contactEntries.forEach(([talker, contact]) => {
        if (contact) {
          nextContacts[talker] = contact
          hasContactUpdate = true
        }
      })

      chatroomEntries.forEach(([talker, chatroom]) => {
        if (chatroom) {
          nextChatrooms[talker] = chatroom
          hasChatroomUpdate = true
        }
      })

      if (hasContactUpdate) {
        searchContacts.value = nextContacts
      }

      if (hasChatroomUpdate) {
        searchChatrooms.value = nextChatrooms
      }
    } finally {
      searchContextLoading.value = false
    }
  }

  function $reset() {
    searchContacts.value = {}
    searchChatrooms.value = {}
    searchContextLoading.value = false
    hydratingChatroomTalkers.clear()
  }

  return {
    // State
    searchContacts,
    searchChatrooms,
    searchContextLoading,

    // Computed
    isSearchMode,
    searchKeywordNormalized,
    sessionSearchMetadataMap,
    searchMatchesMap,
    searchIndexIncomplete,

    // Methods
    getSessionSearchMetadata,
    compareSessionsBase,
    applySessionTypeFilter,
    hydrateSearchContacts,
    $reset,
  }
}
