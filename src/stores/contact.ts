/**
 * 联系人状态管理
 */
import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, computed } from 'vue'
import { contactAPI, getAvatarUrl } from '@/api/contact'
import type { Contact } from '@/types/contact'
import type { ContactFilterType } from '@/types'
import { useAppStore } from './app'
import { db } from '@/utils/db'

import { groupAndSortContacts, generateIndexList, filterContacts } from '@/utils/contact-grouping'

export const useContactStore = defineStore('contact', () => {
  const appStore = useAppStore()

  // ==================== State ====================

  /**
   * 联系人列表
   * 使用 shallowRef 避免对 20000+ 联系人对象做深层响应式代理
   * 修改数组内容后需调用 triggerRef(contacts) 触发更新
   */
  const contacts = shallowRef<Contact[]>([])

  /**
   * 当前选中的联系人 ID
   */
  const currentContactId = ref<string>('')

  /**
   * 联系人总数
   */
  const totalContacts = ref(0)

  /**
   * 筛选类型
   */
  const filterType = ref<ContactFilterType>('all')

  /**
   * 搜索关键词
   */
  const searchKeyword = ref('')

  /**
   * 排序方式
   */
  const sortBy = ref<'name' | 'pinyin' | 'time'>('pinyin')

  /**
   * 是否显示首字母索引
   */
  const showLetterIndex = ref(true)

  /**
   * 加载状态
   */
  const loading = ref(false)

  /**
   * 错误信息
   */
  const error = ref<Error | null>(null)

  /**
   * 后台加载进度
   */
  const loadProgress = ref<{
    loaded: number
    total: number
    percentage: number
    completed?: boolean
    itemsPerSecond?: number
    elapsedTime?: number
    estimatedTimeRemaining?: number
    currentBatch?: number
    totalBatches?: number
    /** 当前阶段：api=正在从 API 拉取, db=正在写入数据库 */
    phase?: 'api' | 'db'
  } | null>(null)

  /**
   * 是否正在后台加载
   */
  const isBackgroundLoading = ref(false)

  // ==================== Getters ====================

  /**
   * 当前选中的联系人
   */
  const currentContact = computed(() => {
    return contacts.value.find(c => c.wxid === currentContactId.value)
  })

  /**
   * 筛选后的联系人列表
   */
  const filteredContacts = computed(() => {
    let result = contacts.value

    // 按类型筛选
    if (filterType.value !== 'all') {
      result = result.filter(c => c.type === filterType.value)
    }

    // 搜索筛选
    if (searchKeyword.value) {
      result = filterContacts(result, searchKeyword.value)
    }

    // 排序
    result = [...result].sort((a, b) => {
      if (sortBy.value === 'name' || sortBy.value === 'pinyin') {
        const nameA = contactAPI.getDisplayName(a)
        const nameB = contactAPI.getDisplayName(b)
        return nameA.localeCompare(nameB, 'zh-CN')
      } else {
        return (b.lastContactTime || 0) - (a.lastContactTime || 0)
      }
    })

    return result
  })

  /**
   * 好友列表
   */
  const friends = computed(() => {
    return contacts.value.filter(c => c.type === 'friend')
  })

  /**
   * 群聊列表
   */
  const chatrooms = computed(() => {
    return contacts.value.filter(c => c.type === 'chatroom')
  })

  /**
   * 公众号列表
   */
  const officialAccounts = computed(() => {
    return contacts.value.filter(c => c.type === 'official')
  })

  /**
   * 星标联系人列表
   */
  const starredContacts = computed(() => {
    return contacts.value.filter(c => c.isStarred)
  })

  /**
   * 按首字母分组的联系人
   */
  /**
   * 联系人分组
   */
  const contactGroups = computed(() => {
    return groupAndSortContacts(filteredContacts.value)
  })

  /**
   * 首字母索引列表
   */
  const letterIndexList = computed(() => {
    return generateIndexList(contactGroups.value)
  })

  /**
   * 联系人统计
   */
  const contactStats = computed(() => {
    return {
      total: contacts.value.length,
      friends: friends.value.length,
      chatrooms: chatrooms.value.length,
      official: officialAccounts.value.length,
      starred: starredContacts.value.length,
    }
  })

  /**
   * 是否有联系人
   */
  const hasContacts = computed(() => contacts.value.length > 0)

  /**
   * 是否有当前联系人
   */
  const hasCurrentContact = computed(() => !!currentContact.value)

  // ==================== Actions ====================

  /**
   * 加载联系人列表（快速模式：先从缓存加载）
   */
  async function loadContacts(keyword?: string) {
    try {
      loading.value = true
      error.value = null
      appStore.setLoading('contacts', true)

      const t0 = performance.now()
      console.log('⏱️ [loadContacts] 开始加载')

      // 先尝试从缓存加载
      const cachedCount = await db.getContactCount()
      console.log(
        `⏱️ [loadContacts] getContactCount: ${cachedCount}，耗时: ${(performance.now() - t0).toFixed(1)}ms`
      )

      if (cachedCount > 0 && !keyword) {
        const t1 = performance.now()
        const cached = await db.getAllContacts()
        const t2 = performance.now()
        console.log(
          `⏱️ [loadContacts] db.getAllContacts 返回 ${cached.length} 条，耗时: ${(t2 - t1).toFixed(1)}ms`
        )

        contacts.value = cached
        const t3 = performance.now()
        console.log(`⏱️ [loadContacts] 赋值 contacts.value 耗时: ${(t3 - t2).toFixed(1)}ms`)

        totalContacts.value = cached.length

        if (appStore.isDebug) {
          console.log('📦 从缓存加载联系人', { count: cached.length })
        }
      } else {
        // 从 API 加载
        const result = await contactAPI.getContacts(keyword ? { keyword } : undefined)
        contacts.value = result
        totalContacts.value = result.length

        // 保存到缓存（仅在无关键词时）
        if (!keyword && result.length > 0) {
          await db.saveContacts(result).catch(err => {
            console.error('保存联系人到缓存失败:', err)
          })
        }
      }

      console.log(`⏱️ [loadContacts] 全部完成，总耗时: ${(performance.now() - t0).toFixed(1)}ms`)

      if (appStore.isDebug) {
        console.log('👥 Contacts loaded', {
          count: totalContacts.value,
          keyword: keyword || 'all',
        })
      }

      return contacts
    } catch (err) {
      // 如果 API 失败，尝试使用缓存
      if (!keyword) {
        const cached = await db.getAllContacts().catch(() => [])
        if (cached.length > 0) {
          contacts.value = cached
          totalContacts.value = cached.length
          console.warn('⚠️ API 失败，使用缓存数据')
          return cached
        }
      }

      error.value = err as Error
      appStore.setError(err as Error)
      throw err
    } finally {
      loading.value = false
      appStore.setLoading('contacts', false)
    }
  }

  /**
   * 取消标志，用于中断加载过程
   */
  let isCancelled = false

  /**
   * 后台批量加载联系人
   *
   * 采用"临时数组 + 延迟更新"策略优化性能：
   * 1. 分批从 API 加载数据，直接 append 到非响应式的临时数组
   * 2. 加载过程中只更新进度状态，不触发联系人列表的 Vue 响应式更新
   * 3. 全部加载完成后，清空 IndexedDB 并一次性全量保存
   * 4. 最后一次性赋值给 contacts.value，只触发一次界面重渲染
   *
   * @param options.batchSize 每批次加载数量，默认 500
   * @param options.batchDelay 批次间延迟（毫秒），默认 100，避免阻塞 UI
   */
  async function loadContactsInBackground(options?: { batchSize?: number; batchDelay?: number }) {
    const tTotal = performance.now()
    console.log('⏱️ [loadContactsInBackground] 开始')

    // 如果已经在后台加载，先取消
    if (isBackgroundLoading.value) {
      isCancelled = true
    }

    const batchSize = options?.batchSize || 500
    const batchDelay = options?.batchDelay || 100

    // 重置取消标志
    isCancelled = false

    // 临时数组，用于存储加载过程中的数据（不触发响应式更新）
    const tempContacts: Contact[] = []

    try {
      isBackgroundLoading.value = true
      error.value = null

      // 获取基准总数，用于计算准确的百分比
      const baselineTotal = totalContacts.value || (await db.getContactCount()) || 0
      const startTime = performance.now()

      // 批量加载所有数据
      let offset = 0
      let hasMore = true
      let batchIndex = 0
      // API 阶段占总进度的 0~80%，DB 写入阶段占 80~100%
      const API_PHASE_WEIGHT = 80

      const tApiFetch = performance.now()
      while (hasMore && !isCancelled) {
        // 调用 API 分页加载
        const tBatch = performance.now()
        const batch = await contactAPI.getContacts({
          limit: batchSize,
          offset,
        })
        console.log(
          `⏱️ [loadContactsInBackground] API 批次 #${batchIndex} (offset=${offset}, limit=${batchSize}) 返回 ${batch.length} 条，耗时: ${(performance.now() - tBatch).toFixed(1)}ms`
        )

        if (batch.length === 0) {
          hasMore = false
          break
        }

        // 直接 append 到临时数组（不做对比合并）
        tempContacts.push(...batch)

        // 更新偏移量
        offset += batch.length
        batchIndex++

        // 计算进度详情
        const elapsedTime = performance.now() - startTime
        const elapsedSec = elapsedTime / 1000
        const itemsPerSecond = elapsedSec > 0 ? tempContacts.length / elapsedSec : 0

        // 百分比计算：如果有基准总数，按比例计算；否则用动态估算
        let apiPercentage: number
        let estimatedTotal: number
        if (baselineTotal > 0) {
          apiPercentage = Math.min(
            API_PHASE_WEIGHT,
            (tempContacts.length / baselineTotal) * API_PHASE_WEIGHT
          )
          estimatedTotal = baselineTotal
        } else {
          // 无基准时的动态估算
          estimatedTotal =
            batch.length < batchSize
              ? tempContacts.length
              : Math.max(tempContacts.length * 1.5, tempContacts.length + batchSize)
          apiPercentage = Math.min(
            API_PHASE_WEIGHT - 1,
            (tempContacts.length / estimatedTotal) * API_PHASE_WEIGHT
          )
        }

        // 预计剩余时间
        const remainingItems = Math.max(0, estimatedTotal - tempContacts.length)
        const estimatedTimeRemaining =
          itemsPerSecond > 0 ? (remainingItems / itemsPerSecond) * 1000 : undefined

        // 估算总批次数
        const estimatedTotalBatches = Math.ceil(estimatedTotal / batchSize)

        loadProgress.value = {
          loaded: tempContacts.length,
          total: estimatedTotal,
          percentage: apiPercentage,
          itemsPerSecond,
          elapsedTime,
          estimatedTimeRemaining,
          currentBatch: batchIndex,
          totalBatches: estimatedTotalBatches,
          phase: 'api',
        }

        if (appStore.isDebug) {
          console.log('📥 后台加载批次', {
            batchSize: batch.length,
            loaded: tempContacts.length,
            percentage: apiPercentage.toFixed(1) + '%',
          })
        }

        // 检查是否还有更多数据
        if (batch.length < batchSize) {
          hasMore = false
        }

        // 批次间延迟（避免阻塞 UI）
        if (hasMore && batchDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, batchDelay))
        }
      }
      console.log(
        `⏱️ [loadContactsInBackground] API 全部批次完成，共 ${tempContacts.length} 条，${batchIndex} 批，耗时: ${(performance.now() - tApiFetch).toFixed(1)}ms`
      )

      // 如果被取消，直接返回
      if (isCancelled) {
        throw new Error('加载已取消')
      }

      // 一次性全量更新：清空 db + 保存（单事务） → 更新 reactive state
      if (tempContacts.length > 0) {
        // 更新进度：进入 DB 写入阶段
        const dbStartTime = performance.now()
        loadProgress.value = {
          loaded: tempContacts.length,
          total: tempContacts.length,
          percentage: API_PHASE_WEIGHT,
          elapsedTime: dbStartTime - startTime,
          phase: 'db',
          currentBatch: 0,
          totalBatches: 0,
        }

        // 在单个 IndexedDB 事务中完成清空和全量保存，减少事务开销
        const tDbWrite = performance.now()
        console.log(
          `⏱️ [loadContactsInBackground] 开始 clearAndSaveContacts，数据量: ${tempContacts.length}`
        )
        await db.clearAndSaveContacts(tempContacts, (currentChunk, totalChunks) => {
          // DB 写入阶段进度回调：从 80% 到 100%
          const dbProgress = currentChunk / totalChunks
          const overallPercentage = API_PHASE_WEIGHT + dbProgress * (100 - API_PHASE_WEIGHT)

          loadProgress.value = {
            loaded: tempContacts.length,
            total: tempContacts.length,
            percentage: overallPercentage,
            elapsedTime: performance.now() - startTime,
            phase: 'db',
            currentBatch: currentChunk,
            totalBatches: totalChunks,
          }
        })
        console.log(
          `⏱️ [loadContactsInBackground] clearAndSaveContacts 完成，耗时: ${(performance.now() - tDbWrite).toFixed(1)}ms`
        )
        if (appStore.isDebug) {
          console.log('💾 已全量保存到数据库（单事务）', { count: tempContacts.length })
        }

        // 原子性更新 reactive state（只触发一次响应式更新）
        const tReactive = performance.now()
        contacts.value = tempContacts
        totalContacts.value = tempContacts.length
        console.log(
          `⏱️ [loadContactsInBackground] 赋值 contacts.value 耗时: ${(performance.now() - tReactive).toFixed(1)}ms`
        )

        if (appStore.isDebug) {
          console.log('✅ 后台加载完成，已全量更新', { count: tempContacts.length })
        }
      }

      // 完成
      loadProgress.value = {
        loaded: tempContacts.length,
        total: tempContacts.length,
        percentage: 100,
        completed: true,
        elapsedTime: performance.now() - startTime,
      }

      console.log(
        `⏱️ [loadContactsInBackground] 全部完成，总耗时: ${(performance.now() - tTotal).toFixed(1)}ms`
      )
    } catch (err) {
      // 错误处理：清空临时数据，保持数据库为空
      tempContacts.length = 0
      if (!isCancelled) {
        error.value = err as Error
        console.error('后台加载失败:', err)
      }
      throw err
    } finally {
      isBackgroundLoading.value = false
      // 延迟清空进度（让用户看到 100%）
      setTimeout(() => {
        if (!isBackgroundLoading.value) {
          loadProgress.value = null
        }
      }, 500)
    }
  }

  /**
   * 取消后台加载
   */
  function cancelBackgroundLoading() {
    isCancelled = true
    isBackgroundLoading.value = false
    loadProgress.value = null
    if (appStore.isDebug) {
      console.log('🛑 已取消后台加载')
    }
  }

  /**
   * 刷新联系人列表
   */
  async function refreshContacts() {
    await loadContacts()
  }

  /**
   * 加载好友列表
   */
  async function loadFriends() {
    await loadContacts()
    // 返回前端过滤后的好友列表
    return friends.value
  }

  /**
   * 加载群聊列表
   */
  async function loadChatrooms() {
    await loadContacts()
    // 返回前端过滤后的群聊列表
    return chatrooms.value
  }

  /**
   * 加载公众号列表
   */
  async function loadOfficialAccounts() {
    await loadContacts()
    // 返回前端过滤后的公众号列表
    return officialAccounts.value
  }

  /**
   * 获取联系人详情
   */
  async function getContactDetail(wxid: string) {
    try {
      // 先尝试从缓存获取
      const cached = await db.getContact(wxid)
      if (cached) {
        // 更新到内存列表
        const index = contacts.value.findIndex(c => c.wxid === wxid)
        if (index !== -1) {
          contacts.value[index] = cached
        } else {
          contacts.value.push(cached)
        }
        triggerRef(contacts)
      }

      // 从 API 获取最新数据
      const contact = await contactAPI.getContactDetail(wxid)

      // 更新或添加到列表
      const index = contacts.value.findIndex(c => c.wxid === wxid)
      if (index !== -1) {
        contacts.value[index] = contact
      } else {
        contacts.value.push(contact)
      }
      triggerRef(contacts)

      // 保存到缓存
      await db.saveContact(contact).catch(err => {
        console.error('保存联系人到缓存失败:', err)
      })

      return contact
    } catch (err) {
      // API 失败时，返回缓存数据
      const cached = await db.getContact(wxid).catch(() => null)
      if (cached) {
        console.warn('⚠️ API 失败，使用缓存数据:', wxid)
        return cached
      }

      error.value = err as Error
      throw err
    }
  }

  /**
   * 选择联系人
   */
  async function selectContact(wxid: string) {
    currentContactId.value = wxid

    // 如果联系人不在列表中，获取详情
    if (!contacts.value.find(c => c.wxid === wxid)) {
      await getContactDetail(wxid)
    }
  }

  /**
   * 设置筛选类型
   */
  function setFilterType(type: ContactFilterType) {
    filterType.value = type
  }

  /**
   * 设置搜索关键词
   */
  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  /**
   * 设置排序方式
   */
  function setSortBy(sort: 'name' | 'pinyin' | 'time') {
    sortBy.value = sort
  }

  /**
   * 切换首字母索引显示
   */
  function toggleLetterIndex() {
    showLetterIndex.value = !showLetterIndex.value
  }

  /**
   * 搜索联系人
   */
  async function searchContacts(keyword: string) {
    try {
      loading.value = true
      const result = await contactAPI.searchContacts(keyword)
      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 星标联系人
   */
  function starContact(wxid: string) {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (contact) {
      contact.isStarred = true
      triggerRef(contacts)
    }
  }

  /**
   * 取消星标
   */
  function unstarContact(wxid: string) {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (contact) {
      contact.isStarred = false
      triggerRef(contacts)
    }
  }

  /**
   * 切换星标状态
   */
  function toggleStarContact(wxid: string) {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (contact) {
      contact.isStarred = !contact.isStarred
      triggerRef(contacts)
    }
  }

  /**
   * 更新联系人信息
   */
  function updateContact(wxid: string, updates: Partial<Contact>) {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (contact) {
      Object.assign(contact, updates)
      triggerRef(contacts)
    }
  }

  /**
   * 删除联系人（本地）
   */
  function deleteContact(wxid: string) {
    const index = contacts.value.findIndex(c => c.wxid === wxid)
    if (index !== -1) {
      contacts.value.splice(index, 1)
      triggerRef(contacts)
    }

    // 如果删除的是当前联系人，清除选择
    if (currentContactId.value === wxid) {
      currentContactId.value = ''
    }
  }

  /**
   * 批量添加联系人（本地）
   */
  function addContacts(newContacts: Contact[]) {
    // 去重：只添加不存在的联系人
    const existingIds = new Set(contacts.value.map(c => c.wxid))
    const uniqueContacts = newContacts.filter(c => !existingIds.has(c.wxid))

    if (uniqueContacts.length > 0) {
      contacts.value.push(...uniqueContacts)
      totalContacts.value = contacts.value.length
      triggerRef(contacts)
    }

    return uniqueContacts.length
  }

  /**
   * 获取联系人显示名称（优先使用缓存）
   */
  async function getContactDisplayName(wxid: string): Promise<string> {
    // 先从内存查找
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (contact) {
      return contactAPI.getDisplayName(contact)
    }

    // 从缓存查找
    const cached = await db.getContact(wxid).catch(() => null)
    if (cached) {
      return contactAPI.getDisplayName(cached)
    }

    // 返回 wxid
    return wxid
  }

  /**
   * 同步获取联系人显示名称（仅内存）
   */
  function getContactDisplayNameSync(wxid: string): string {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (!contact) return wxid
    return contactAPI.getDisplayName(contact)
  }

  /**
   * 获取联系人头像
   */
  /**
   * 获取联系人头像
   * @param wxid 联系人微信 ID
   * @param size 头像尺寸，'big' | 'small'，默认 'small'
   * @returns 头像 URL
   */
  function getContactAvatar(wxid: string, size: 'big' | 'small' = 'small'): string {
    const contact = contacts.value.find(c => c.wxid === wxid)
    if (!contact) return ''

    // 优先使用后端返回的头像 URL
    if (size === 'big' && contact.bigHeadImgUrl) {
      return contact.bigHeadImgUrl
    }
    if (size === 'small' && contact.smallHeadImgUrl) {
      return contact.smallHeadImgUrl
    }

    // 其次使用 contact.avatar（可能是 smallHeadImgUrl 或通过 headImgMd5 生成的）
    if (contact.avatar) {
      return contact.avatar
    }

    // 最后尝试通过 headImgMd5 生成
    if (contact.wxid) {
      return getAvatarUrl(contact.wxid)
    }

    return ''
  }

  /**
   * 获取群成员列表
   */
  async function getChatroomMembers(chatroomId: string) {
    try {
      loading.value = true
      const members = await contactAPI.getChatroomMembers(chatroomId)
      return members
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量获取联系人详情
   */
  async function getBatchContactDetails(wxids: string[]) {
    try {
      loading.value = true

      // 先从缓存获取
      const needFetch: string[] = []
      let changed = false

      for (const wxid of wxids) {
        const cached = await db.getContact(wxid).catch(() => null)
        if (cached) {
          // 合并缓存数据到内存
          const index = contacts.value.findIndex(c => c.wxid === wxid)
          if (index !== -1) {
            contacts.value[index] = cached
          } else {
            contacts.value.push(cached)
          }
          changed = true
        } else {
          needFetch.push(wxid)
        }
      }

      // 从 API 获取未缓存的数据
      let result: Contact[] = []
      if (needFetch.length > 0) {
        result = await contactAPI.getBatchContactDetails(needFetch)

        // 合并到列表并保存到缓存
        result.forEach(contact => {
          const index = contacts.value.findIndex(c => c.wxid === contact.wxid)
          if (index !== -1) {
            contacts.value[index] = contact
          } else {
            contacts.value.push(contact)
          }
        })
        changed = true

        // 批量保存到缓存
        if (result.length > 0) {
          await db.saveContacts(result).catch(err => {
            console.error('批量保存联系人到缓存失败:', err)
          })
        }
      }

      if (changed) {
        triggerRef(contacts)
      }

      // 返回所有联系人（缓存 + 新获取）
      return contacts.value.filter(c => wxids.includes(c.wxid))
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取首字母
   */
  function getFirstLetter(name: string): string {
    if (!name) return '#'

    const firstChar = name.charAt(0).toUpperCase()

    // 如果是英文字母
    if (/[A-Z]/.test(firstChar)) {
      return firstChar
    }

    // 中文转拼音首字母（简单实现，实际可能需要拼音库）
    const code = firstChar.charCodeAt(0)
    if (code >= 0x4e00 && code <= 0x9fa5) {
      // 中文字符范围，简单映射到 A-Z
      // 实际应该使用拼音库如 pinyin-pro
      return getPinyinFirstLetter(firstChar)
    }

    // 其他字符归类到 #
    return '#'
  }

  /**
   * 获取中文拼音首字母（简化版）
   */
  function getPinyinFirstLetter(char: string): string {
    // 这是一个简化的实现，实际项目中应该使用专业的拼音库
    // 这里只做示例，返回基于 Unicode 的粗略映射
    const code = char.charCodeAt(0)

    if (code >= 0x4e00 && code <= 0x9fa5) {
      // 简单的 Unicode 范围映射
      const offset = code - 0x4e00
      const letterIndex = Math.floor(offset / ((0x9fa5 - 0x4e00) / 26))
      return String.fromCharCode(65 + Math.min(letterIndex, 25))
    }

    return '#'
  }

  /**
   * 跳转到指定首字母
   */
  function jumpToLetter(letter: string) {
    const element = document.getElementById(`contact-letter-${letter}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  /**
   * 清除搜索
   */
  function clearSearch() {
    searchKeyword.value = ''
  }

  /**
   * 清除筛选
   */
  function clearFilter() {
    filterType.value = 'all'
    searchKeyword.value = ''
  }

  /**
   * 清除错误
   */
  function clearError() {
    error.value = null
  }

  /**
   * 清除缓存
   */
  async function clearCache() {
    try {
      await db.clearContacts()
      console.log('🗑️ 联系人缓存已清空')
    } catch (err) {
      console.error('清空缓存失败:', err)
    }
  }

  /**
   * 重置状态
   */
  function $reset() {
    contacts.value = []
    currentContactId.value = ''
    totalContacts.value = 0
    filterType.value = 'all'
    searchKeyword.value = ''
    sortBy.value = 'name'
    showLetterIndex.value = true
    loading.value = false
    error.value = null
  }

  // ==================== Return ====================

  return {
    // State
    contacts,
    currentContactId,
    totalContacts,
    filterType,
    searchKeyword,
    sortBy,
    showLetterIndex,
    loading,
    error,
    loadProgress,
    isBackgroundLoading,

    // Getters
    currentContact,
    filteredContacts,
    friends,
    chatrooms,
    officialAccounts,
    starredContacts,
    contactGroups,
    letterIndexList,
    contactStats,
    hasContacts,
    hasCurrentContact,

    // Actions
    loadContacts,
    loadContactsInBackground,
    cancelBackgroundLoading,
    refreshContacts,
    loadFriends,
    loadChatrooms,
    loadOfficialAccounts,
    getContactDetail,
    selectContact,
    setFilterType,
    setSearchKeyword,
    setSortBy,
    toggleLetterIndex,
    searchContacts,
    starContact,
    unstarContact,
    toggleStarContact,
    updateContact,
    deleteContact,
    addContacts,
    getContactDisplayName,
    getContactDisplayNameSync,
    getContactAvatar,
    getChatroomMembers,
    getBatchContactDetails,
    getFirstLetter,
    jumpToLetter,
    clearSearch,
    clearFilter,
    clearError,
    clearCache,
    $reset,
  }
})
