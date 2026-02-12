/**
 * IndexedDB Web Worker
 *
 * 在后台线程中执行 IndexedDB 写入操作，避免阻塞主线程导致 UI 卡顿。
 * 主线程通过 postMessage 发送写入命令，Worker 在后台完成后回复结果。
 *
 * 支持的操作：
 * - clearAndSaveMany: 在单事务中清空 + 批量写入
 * - saveMany: 批量写入
 * - clear: 清空对象存储
 */

// ==================== 类型定义 ====================

interface DBStoreConfig {
  name: string
  keyPath: string | string[]
  autoIncrement?: boolean
  indexes?: {
    name: string
    keyPath: string | string[]
    unique?: boolean
  }[]
}

interface DBConfig {
  name: string
  version: number
  stores: DBStoreConfig[]
}

/** 主线程 → Worker 的消息 */
interface WorkerRequest {
  id: string
  action: 'init' | 'clearAndSaveMany' | 'saveMany' | 'clear'
  dbConfig?: DBConfig
  storeName?: string
  items?: any[]
}

/** Worker → 主线程的消息 */
interface WorkerResponse {
  id: string
  success: boolean
  error?: string
}

// ==================== 常量 ====================

/** 每个事务的最大写入条数，避免单事务刷盘数据量过大导致提交极慢 */
const CHUNK_SIZE = 2000

// ==================== Worker 实现 ====================

let db: IDBDatabase | null = null

/**
 * 打开/初始化数据库
 */
function openDB(config: DBConfig): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(config.name, config.version)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result

      config.stores.forEach(storeConfig => {
        if (!database.objectStoreNames.contains(storeConfig.name)) {
          const params: IDBObjectStoreParameters = {
            keyPath: storeConfig.keyPath,
          }
          if (storeConfig.autoIncrement !== undefined) {
            params.autoIncrement = storeConfig.autoIncrement
          }

          const store = database.createObjectStore(storeConfig.name, params)

          if (storeConfig.indexes) {
            storeConfig.indexes.forEach(index => {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique || false,
              })
            })
          }
        }
      })
    }
  })
}

/**
 * 确保数据库已初始化
 */
async function ensureDB(config?: DBConfig): Promise<IDBDatabase> {
  if (db) return db
  if (!config) throw new Error('Worker: 数据库未初始化且未提供配置')
  return openDB(config)
}

/**
 * 在单个事务中写入一批数据
 * 使用 relaxed durability 跳过 fsync，适用于可重建的缓存数据
 */
function writeChunk(database: IDBDatabase, storeName: string, items: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite', { durability: 'relaxed' })
    const store = transaction.objectStore(storeName)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'))

    for (const item of items) {
      store.put(item)
    }
  })
}

/**
 * 清空并分块批量写入
 *
 * 将大量数据拆分为多个小事务（每个 CHUNK_SIZE 条），
 * 避免单事务提交时刷盘数据量过大导致耗时数十秒。
 * 第一个事务负责 clear + 写入第一块，后续事务只写入。
 */
async function clearAndSaveMany(
  database: IDBDatabase,
  storeName: string,
  items: any[]
): Promise<void> {
  const t0 = performance.now()
  const totalChunks = Math.ceil(items.length / CHUNK_SIZE)
  console.log(
    `⏱️ [Worker clearAndSaveMany] 开始，${items.length} 条到 [${storeName}]，分 ${totalChunks} 块（每块 ${CHUNK_SIZE}）`
  )

  // 第一个事务：clear + 写入第一块
  await new Promise<void>((resolve, reject) => {
    const firstChunk = items.slice(0, CHUNK_SIZE)
    const transaction = database.transaction([storeName], 'readwrite', { durability: 'relaxed' })
    const store = transaction.objectStore(storeName)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'))

    store.clear()
    for (const item of firstChunk) {
      store.put(item)
    }
  })
  console.log(
    `⏱️ [Worker clearAndSaveMany] 块 1/${totalChunks} 完成（含 clear），耗时: ${(performance.now() - t0).toFixed(1)}ms`
  )

  // 后续事务：每块 CHUNK_SIZE 条
  for (let i = 1; i < totalChunks; i++) {
    const tChunk = performance.now()
    const chunk = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    await writeChunk(database, storeName, chunk)
    console.log(
      `⏱️ [Worker clearAndSaveMany] 块 ${i + 1}/${totalChunks} 完成（${chunk.length} 条），耗时: ${(performance.now() - tChunk).toFixed(1)}ms`
    )
  }

  console.log(
    `⏱️ [Worker clearAndSaveMany] 全部完成，总耗时: ${(performance.now() - t0).toFixed(1)}ms`
  )
}

/**
 * 分块批量写入
 */
async function saveMany(database: IDBDatabase, storeName: string, items: any[]): Promise<void> {
  const t0 = performance.now()
  const totalChunks = Math.ceil(items.length / CHUNK_SIZE)
  console.log(
    `⏱️ [Worker saveMany] 开始，${items.length} 条到 [${storeName}]，分 ${totalChunks} 块`
  )

  for (let i = 0; i < totalChunks; i++) {
    const tChunk = performance.now()
    const chunk = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    await writeChunk(database, storeName, chunk)
    console.log(
      `⏱️ [Worker saveMany] 块 ${i + 1}/${totalChunks} 完成（${chunk.length} 条），耗时: ${(performance.now() - tChunk).toFixed(1)}ms`
    )
  }

  console.log(`⏱️ [Worker saveMany] 全部完成，总耗时: ${(performance.now() - t0).toFixed(1)}ms`)
}

/**
 * 清空对象存储
 */
function clear(database: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite', { durability: 'relaxed' })
    const store = transaction.objectStore(storeName)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'))

    store.clear()
  })
}

// ==================== 消息处理 ====================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, action, dbConfig, storeName, items } = event.data

  const respond = (success: boolean, error?: string) => {
    const response: WorkerResponse = { id, success, error }
    self.postMessage(response)
  }

  try {
    switch (action) {
      case 'init': {
        if (!dbConfig) throw new Error('init 需要 dbConfig')
        await openDB(dbConfig)
        respond(true)
        break
      }

      case 'clearAndSaveMany': {
        if (!storeName) throw new Error('clearAndSaveMany 需要 storeName')
        const database = await ensureDB(dbConfig)
        await clearAndSaveMany(database, storeName, items || [])
        respond(true)
        break
      }

      case 'saveMany': {
        if (!storeName) throw new Error('saveMany 需要 storeName')
        const database = await ensureDB(dbConfig)
        await saveMany(database, storeName, items || [])
        respond(true)
        break
      }

      case 'clear': {
        if (!storeName) throw new Error('clear 需要 storeName')
        const database = await ensureDB(dbConfig)
        await clear(database, storeName)
        respond(true)
        break
      }

      default:
        respond(false, `未知操作: ${action}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    respond(false, message)
  }
}
