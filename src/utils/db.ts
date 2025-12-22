/**
 * 联系人和群聊数据库
 * 基于 BaseDatabase 重构
 */

import { BaseDatabase, type DBConfig } from './base-db'
import type { Contact, Chatroom } from '@/types'

const CONTACT_STORE = 'contacts'
const CHATROOM_STORE = 'chatrooms'

/**
 * 联系人和群聊数据库类
 */
class Database extends BaseDatabase {
  protected config: DBConfig = {
    name: 'ChatlogSessionDB',
    version: 3,
    stores: [
      {
        name: CONTACT_STORE,
        keyPath: 'wxid',
        indexes: [
          { name: 'nickname', keyPath: 'nickname', unique: false },
          { name: 'remark', keyPath: 'remark', unique: false },
          { name: 'alias', keyPath: 'alias', unique: false },
          { name: 'type', keyPath: 'type', unique: false },
          { name: 'verifyFlag', keyPath: 'verifyFlag', unique: false },
          { name: 'reserved1', keyPath: 'reserved1', unique: false }
        ]
      },
      {
        name: CHATROOM_STORE,
        keyPath: 'chatroomId',
        indexes: [
          { name: 'name', keyPath: 'name', unique: false },
          { name: 'memberCount', keyPath: 'memberCount', unique: false },
          { name: 'reserved1', keyPath: 'reserved1', unique: false }
        ]
      }
    ]
  }

  // ==================== 联系人相关方法 ====================

  /**
   * 保存联系人
   */
  async saveContact(contact: Contact): Promise<string> {
    return await this.save(CONTACT_STORE, contact) as string
  }

  /**
   * 批量保存联系人
   */
  async saveContacts(contacts: Contact[]): Promise<void> {
    if (!contacts || contacts.length === 0) {
      console.warn('批量保存联系人：数组为空')
      return
    }

    console.log(`开始批量保存 ${contacts.length} 个联系人...`)
    await this.saveMany(CONTACT_STORE, contacts)
    console.log('✅ 批量保存联系人完成')
  }

  /**
   * 获取联系人
   */
  async getContact(wxid: string): Promise<Contact | null> {
    return await this.get<Contact>(CONTACT_STORE, wxid)
  }

  /**
   * 获取联系人列表（分页）
   */
  async getContacts(offset: number = 0, limit: number = 100): Promise<{
    contacts: Contact[]
    total: number
    hasMore: boolean
  }> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const result: Contact[] = []
      const transaction = db.transaction([CONTACT_STORE], 'readonly')
      const store = transaction.objectStore(CONTACT_STORE)

      let completed = 0
      const total = offset + limit

      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          if (completed >= offset && completed < total) {
            result.push(cursor.value)
          }
          completed++
          if (completed < total) {
            cursor.continue()
          } else {
            resolve({
              contacts: result,
              total: completed,
              hasMore: true
            })
          }
        } else {
          resolve({
            contacts: result,
            total: completed,
            hasMore: false
          })
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 批量获取联系人（按 wxid 列表）
   */
  async getBatchContacts(wxids: string[]): Promise<Map<string, Contact>> {
    const result = new Map<string, Contact>()
    
    await Promise.all(
      wxids.map(async (wxid) => {
        const contact = await this.getContact(wxid)
        if (contact) {
          result.set(wxid, contact)
        }
      })
    )
    
    return result
  }

  /**
   * 获取所有联系人
   */
  async getAllContacts(): Promise<Contact[]> {
    return await this.getAll<Contact>(CONTACT_STORE)
  }

  /**
   * 按类型获取联系人
   */
  async getContactsByType(type: number): Promise<Contact[]> {
    return await this.getByIndex<Contact>(CONTACT_STORE, 'type', type)
  }

  /**
   * 搜索联系人
   */
  async searchContacts(keyword: string): Promise<Contact[]> {
    const allContacts = await this.getAllContacts()
    const lowerKeyword = keyword.toLowerCase()

    return allContacts.filter(contact => {
      const nickname = (contact.nickname || '').toLowerCase()
      const remark = (contact.remark || '').toLowerCase()
      const wxid = (contact.wxid || '').toLowerCase()
      const alias = (contact.alias || '').toLowerCase()

      return nickname.includes(lowerKeyword) ||
             remark.includes(lowerKeyword) ||
             wxid.includes(lowerKeyword) ||
             alias.includes(lowerKeyword)
    })
  }

  /**
   * 删除联系人
   */
  async deleteContact(wxid: string): Promise<void> {
    await this.delete(CONTACT_STORE, wxid)
  }

  /**
   * 清空所有联系人
   */
  async clearContacts(): Promise<void> {
    await this.clear(CONTACT_STORE)
  }

  /**
   * 获取联系人数量
   */
  async getContactCount(): Promise<number> {
    return await this.count(CONTACT_STORE)
  }

  /**
   * 检查联系人是否存在
   */
  async hasContact(wxid: string): Promise<boolean> {
    const contact = await this.getContact(wxid)
    return contact !== null
  }

  /**
   * 获取联系人显示名称
   */
  async getContactDisplayName(wxid: string): Promise<string> {
    const contact = await this.getContact(wxid)
    return contact?.remark || contact?.nickname || wxid
  }

  /**
   * 批量获取联系人显示名称
   */
  async getContactDisplayNames(wxids: string[]): Promise<Record<string, string>> {
    const contacts = await Promise.all(
      wxids.map(wxid => this.getContact(wxid))
    )
    
    const result: Record<string, string> = {}
    wxids.forEach((wxid, index) => {
      const contact = contacts[index]
      result[wxid] = contact?.remark || contact?.nickname || wxid
    })
    
    return result
  }

  // ==================== 群聊相关方法 ====================

  /**
   * 保存群聊
   */
  async saveChatroom(chatroom: Chatroom): Promise<string> {
    return await this.save(CHATROOM_STORE, chatroom) as string
  }

  /**
   * 批量保存群聊
   */
  async saveChatrooms(chatrooms: Chatroom[]): Promise<void> {
    if (!chatrooms || chatrooms.length === 0) {
      console.warn('批量保存群聊：数组为空')
      return
    }

    console.log(`开始批量保存 ${chatrooms.length} 个群聊...`)
    await this.saveMany(CHATROOM_STORE, chatrooms)
    console.log('✅ 批量保存群聊完成')
  }

  /**
   * 获取群聊
   */
  async getChatroom(chatroomId: string): Promise<Chatroom | null> {
    return await this.get<Chatroom>(CHATROOM_STORE, chatroomId)
  }

  /**
   * 获取群聊列表（分页）
   */
  async getChatrooms(offset: number = 0, limit: number = 100): Promise<{
    chatrooms: Chatroom[]
    total: number
    hasMore: boolean
  }> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const result: Chatroom[] = []
      const transaction = db.transaction([CHATROOM_STORE], 'readonly')
      const store = transaction.objectStore(CHATROOM_STORE)

      let completed = 0
      const total = offset + limit

      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          if (completed >= offset && completed < total) {
            result.push(cursor.value)
          }
          completed++
          if (completed < total) {
            cursor.continue()
          } else {
            resolve({
              chatrooms: result,
              total: completed,
              hasMore: true
            })
          }
        } else {
          resolve({
            chatrooms: result,
            total: completed,
            hasMore: false
          })
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 批量获取群聊（按 chatroomId 列表）
   */
  async getBatchChatrooms(chatroomIds: string[]): Promise<Map<string, Chatroom>> {
    const result = new Map<string, Chatroom>()
    
    await Promise.all(
      chatroomIds.map(async (chatroomId) => {
        const chatroom = await this.getChatroom(chatroomId)
        if (chatroom) {
          result.set(chatroomId, chatroom)
        }
      })
    )
    
    return result
  }

  /**
   * 获取所有群聊
   */
  async getAllChatrooms(): Promise<Chatroom[]> {
    return await this.getAll<Chatroom>(CHATROOM_STORE)
  }

  /**
   * 搜索群聊
   */
  async searchChatrooms(keyword: string): Promise<Chatroom[]> {
    const allChatrooms = await this.getAllChatrooms()
    const lowerKeyword = keyword.toLowerCase()

    return allChatrooms.filter(chatroom => {
      const name = (chatroom.name || '').toLowerCase()
      const chatroomId = (chatroom.chatroomId || '').toLowerCase()

      return name.includes(lowerKeyword) || chatroomId.includes(lowerKeyword)
    })
  }

  /**
   * 删除群聊
   */
  async deleteChatroom(chatroomId: string): Promise<void> {
    await this.delete(CHATROOM_STORE, chatroomId)
  }

  /**
   * 清空所有群聊
   */
  async clearChatrooms(): Promise<void> {
    await this.clear(CHATROOM_STORE)
  }

  /**
   * 获取群聊数量
   */
  async getChatroomCount(): Promise<number> {
    return await this.count(CHATROOM_STORE)
  }

  /**
   * 检查群聊是否存在
   */
  async hasChatroom(chatroomId: string): Promise<boolean> {
    const chatroom = await this.getChatroom(chatroomId)
    return chatroom !== null
  }
}

/**
 * 导出单例
 */
export const db = new Database()