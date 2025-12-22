/**
 * IndexedDB 基础类
 * 提供通用的数据库操作方法
 */

export interface DBStoreConfig {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes?: {
    name: string
    keyPath: string | string[]
    unique?: boolean
  }[]
}

export interface DBConfig {
  name: string
  version: number
  stores: DBStoreConfig[]
}

/**
 * IndexedDB 基础操作类
 */
export abstract class BaseDatabase {
  protected db: IDBDatabase | null = null
  protected initPromise: Promise<IDBDatabase> | null = null
  protected abstract config: DBConfig

  /**
   * 初始化数据库
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }

    if (this.initPromise) {
      return this.initPromise
    }

    const config = this.config

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(config.name, config.version)

      request.onerror = () => {
        console.error(`❌ IndexedDB [${config.name}] 打开失败:`, request.error)
        this.initPromise = null
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log(`✅ IndexedDB [${config.name}] 初始化成功`)
        console.log('📦 对象存储:', Array.from(this.db.objectStoreNames))
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion

        console.log(`🔄 数据库 [${config.name}] 升级 v${oldVersion} → v${config.version}`)

        // 创建对象存储
        config.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const objectStoreParams: IDBObjectStoreParameters = {
              keyPath: storeConfig.keyPath
            }

            if (storeConfig.autoIncrement !== undefined) {
              objectStoreParams.autoIncrement = storeConfig.autoIncrement
            }

            const store = db.createObjectStore(storeConfig.name, objectStoreParams)

            // 创建索引
            if (storeConfig.indexes) {
              storeConfig.indexes.forEach(index => {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false
                })
              })
            }

            console.log(`✅ 创建对象存储: ${storeConfig.name}`)
          }
        })

        console.log('✅ 数据库升级完成')
      }

      request.onblocked = () => {
        console.warn(`⚠️ IndexedDB [${config.name}] 升级被阻止，请关闭其他标签页`)
      }
    })

    return this.initPromise
  }

  /**
   * 获取数据库实例
   */
  protected async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = await this.init()
    }
    return this.db
  }

  /**
   * 检查对象存储是否存在
   */
  protected async checkStore(storeName: string): Promise<boolean> {
    try {
      const db = await this.getDB()
      return db.objectStoreNames.contains(storeName)
    } catch (error) {
      console.error('检查对象存储失败:', error)
      return false
    }
  }

  /**
   * 通用保存方法（添加或更新）
   */
  protected async save<T = any>(
    storeName: string,
    data: T
  ): Promise<number | string> {
    try {
      const db = await this.getDB()

      // 检查对象存储是否存在
      if (!db.objectStoreNames.contains(storeName)) {
        console.error('❌ 对象存储不存在:', storeName)
        throw new Error(`Object store "${storeName}" not found`)
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)

        const hasId = data && typeof data === 'object' && 'id' in data && data.id !== undefined
        const request = hasId ? store.put(data) : store.add(data)

        request.onsuccess = () => {
          resolve(request.result as number | string)
        }

        request.onerror = () => {
          console.error(`❌ 保存失败 [${storeName}]:`, request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error(`❌ save 错误 [${storeName}]:`, error)
      throw error
    }
  }

  /**
   * 通用批量保存方法
   */
  protected async saveMany<T>(
    storeName: string,
    items: T[]
  ): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)

      let completed = 0
      const total = items.length

      items.forEach(item => {
        const request = store.put(item)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          console.error(`❌ 批量保存失败 [${storeName}]:`, request.error)
          reject(request.error)
        }
      })

      // 处理空数组情况
      if (total === 0) {
        resolve()
      }
    })
  }

  /**
   * 通用获取方法（按主键）
   */
  protected async get<T>(
    storeName: string,
    key: number | string
  ): Promise<T | null> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        console.error(`❌ 获取失败 [${storeName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用获取所有方法
   */
  protected async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        console.error(`❌ 获取所有失败 [${storeName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用按索引查询方法
   */
  protected async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: any
  ): Promise<T[]> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll(value)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        console.error(`❌ 按索引查询失败 [${storeName}.${indexName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用按索引范围查询方法
   */
  protected async getByIndexRange<T>(
    storeName: string,
    indexName: string,
    range?: IDBKeyRange,
    direction: IDBCursorDirection = 'next'
  ): Promise<T[]> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.openCursor(range, direction)
      const results: T[] = []

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        console.error(`❌ 按索引范围查询失败 [${storeName}.${indexName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用删除方法
   */
  protected async delete(
    storeName: string,
    key: number | string
  ): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        console.error(`❌ 删除失败 [${storeName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用批量删除方法
   */
  protected async deleteMany(
    storeName: string,
    keys: (number | string)[]
  ): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)

      let completed = 0
      const total = keys.length

      keys.forEach(key => {
        const request = store.delete(key)

        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }

        request.onerror = () => {
          console.error(`❌ 批量删除失败 [${storeName}]:`, request.error)
          reject(request.error)
        }
      })

      // 处理空数组情况
      if (total === 0) {
        resolve()
      }
    })
  }

  /**
   * 通用清空方法
   */
  protected async clear(storeName: string): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onsuccess = () => {
        console.log(`🗑️ 已清空 [${storeName}]`)
        resolve()
      }

      request.onerror = () => {
        console.error(`❌ 清空失败 [${storeName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 通用计数方法
   */
  protected async count(storeName: string): Promise<number> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        console.error(`❌ 计数失败 [${storeName}]:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * 检查数据库是否正常
   */
  async checkDatabase(): Promise<boolean> {
    try {
      const db = await this.getDB()
      const config = this.config

      // 检查所有必需的对象存储是否存在
      for (const store of config.stores) {
        if (!db.objectStoreNames.contains(store.name)) {
          console.error(`❌ 缺少对象存储: ${store.name}`)
          return false
        }
      }

      console.log(`✅ 数据库 [${config.name}] 检查通过`)
      return true
    } catch (error) {
      console.error(`❌ 数据库 [${this.config.name}] 检查失败:`, error)
      return false
    }
  }

  /**
   * 重置数据库（删除并重新创建）
   */
  async resetDatabase(): Promise<void> {
    const config = this.config

    return new Promise((resolve, reject) => {
      // 先关闭现有连接
      this.close()

      // 删除数据库
      const deleteRequest = indexedDB.deleteDatabase(config.name)

      deleteRequest.onsuccess = async () => {
        console.log(`🗑️ 数据库 [${config.name}] 已删除`)

        try {
          // 重新初始化
          await this.init()
          console.log(`✅ 数据库 [${config.name}] 已重置`)
          resolve()
        } catch (error) {
          console.error(`❌ 数据库 [${config.name}] 重置失败:`, error)
          reject(error)
        }
      }

      deleteRequest.onerror = () => {
        console.error(`❌ 删除数据库 [${config.name}] 失败:`, deleteRequest.error)
        reject(deleteRequest.error)
      }

      deleteRequest.onblocked = () => {
        console.warn(`⚠️ 删除数据库 [${config.name}] 被阻止，请关闭所有使用该数据库的标签页`)
        reject(new Error('Database deletion blocked'))
      }
    })
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
      console.log(`🔒 数据库 [${this.config.name}] 已关闭`)
    }
  }

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    const db = await this.getDB()
    const cfg = this.config

    return new Promise((resolve, reject) => {
      const storeNames = cfg.stores.map(s => s.name)
      const transaction = db.transaction(storeNames, 'readwrite')

      storeNames.forEach(storeName => {
        transaction.objectStore(storeName).clear()
      })

      transaction.oncomplete = () => {
        console.log(`🗑️ 已清空数据库 [${cfg.name}] 所有数据`)
        resolve()
      }

      transaction.onerror = () => {
        console.error(`❌ 清空数据库 [${cfg.name}] 失败:`, transaction.error)
        reject(transaction.error)
      }
    })
  }
}