/**
 * 消息类型配置验证测试
 * 用于检查配置的完整性和正确性
 */

import { MESSAGE_TYPE_CONFIGS, findMessageTypeConfig } from './config'
import { MESSAGE_COMPONENT_REGISTRY } from './registry'

/**
 * 验证所有配置的组件是否已注册
 */
export function validateComponentRegistry() {
  const errors: string[] = []
  const warnings: string[] = []

  MESSAGE_TYPE_CONFIGS.forEach(config => {
    const componentName = config.component
    
    // 检查组件是否在注册表中
    if (!MESSAGE_COMPONENT_REGISTRY[componentName]) {
      errors.push(
        `组件 "${componentName}" 在配置中使用但未在 registry.ts 中注册 (type=${config.type}, subType=${config.subType})`
      )
    }
    
    // 检查必填字段
    if (!config.name) {
      warnings.push(`配置缺少 name 字段: ${componentName}`)
    }
    if (!config.icon) {
      warnings.push(`配置缺少 icon 字段: ${componentName}`)
    }
    if (!config.placeholder) {
      warnings.push(`配置缺少 placeholder 字段: ${componentName}`)
    }
  })

  return { errors, warnings }
}

/**
 * 验证配置查找功能
 */
export function validateConfigLookup() {
  const testCases = [
    { type: 1, subType: undefined, expectedName: '文本' },
    { type: 3, subType: undefined, expectedName: '图片' },
    { type: 49, subType: 8, expectedName: '表情包(未下载)' },
    { type: 49, subType: 5, expectedName: '链接' },
    { type: 49, subType: 57, expectedName: '引用消息' },
  ]

  const errors: string[] = []

  testCases.forEach(({ type, subType, expectedName }) => {
    const config = findMessageTypeConfig(type, subType)
    if (!config) {
      errors.push(`无法找到配置: type=${type}, subType=${subType}`)
    } else if (config.name !== expectedName) {
      errors.push(
        `配置名称不匹配: type=${type}, subType=${subType}, ` +
        `expected="${expectedName}", got="${config.name}"`
      )
    }
  })

  return { errors }
}

/**
 * 检查重复配置
 */
export function validateDuplicateConfigs() {
  const seen = new Set<string>()
  const duplicates: string[] = []

  MESSAGE_TYPE_CONFIGS.forEach(config => {
    const key = config.subType !== undefined 
      ? `${config.type}-${config.subType}` 
      : `${config.type}`
    
    if (seen.has(key)) {
      duplicates.push(`重复配置: type=${config.type}, subType=${config.subType}`)
    }
    seen.add(key)
  })

  return { duplicates }
}

/**
 * 运行所有验证
 */
export function runAllValidations() {
  console.group('🔍 消息类型配置验证')

  // 1. 验证组件注册
  console.log('1️⃣ 验证组件注册...')
  const registryResult = validateComponentRegistry()
  if (registryResult.errors.length > 0) {
    console.error('❌ 发现错误:')
    registryResult.errors.forEach(err => console.error(`  - ${err}`))
  } else {
    console.log('✅ 所有组件已正确注册')
  }
  if (registryResult.warnings.length > 0) {
    console.warn('⚠️ 警告:')
    registryResult.warnings.forEach(warn => console.warn(`  - ${warn}`))
  }

  // 2. 验证配置查找
  console.log('\n2️⃣ 验证配置查找...')
  const lookupResult = validateConfigLookup()
  if (lookupResult.errors.length > 0) {
    console.error('❌ 发现错误:')
    lookupResult.errors.forEach(err => console.error(`  - ${err}`))
  } else {
    console.log('✅ 配置查找正常')
  }

  // 3. 检查重复配置
  console.log('\n3️⃣ 检查重复配置...')
  const duplicateResult = validateDuplicateConfigs()
  if (duplicateResult.duplicates.length > 0) {
    console.error('❌ 发现重复配置:')
    duplicateResult.duplicates.forEach(dup => console.error(`  - ${dup}`))
  } else {
    console.log('✅ 无重复配置')
  }

  // 4. 统计信息
  console.log('\n📊 统计信息:')
  console.log(`  - 配置总数: ${MESSAGE_TYPE_CONFIGS.length}`)
  console.log(`  - 注册组件数: ${Object.keys(MESSAGE_COMPONENT_REGISTRY).length}`)
  
  const basicTypes = MESSAGE_TYPE_CONFIGS.filter(c => c.subType === undefined)
  const richTypes = MESSAGE_TYPE_CONFIGS.filter(c => c.subType !== undefined)
  console.log(`  - 基础消息类型: ${basicTypes.length}`)
  console.log(`  - 富文本消息类型: ${richTypes.length}`)

  console.groupEnd()

  // 返回总体结果
  const hasErrors = 
    registryResult.errors.length > 0 ||
    lookupResult.errors.length > 0 ||
    duplicateResult.duplicates.length > 0

  return {
    success: !hasErrors,
    totalErrors: 
      registryResult.errors.length +
      lookupResult.errors.length +
      duplicateResult.duplicates.length,
    totalWarnings: registryResult.warnings.length
  }
}

// 开发环境下自动运行验证
if (import.meta.env.DEV) {
  // 延迟执行，确保所有模块加载完成
  setTimeout(() => {
    runAllValidations()
  }, 1000)
}