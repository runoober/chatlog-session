# Changelog

## [0.17.0] - 2026-02-11

### Optimized

#### 后台联系人刷新性能优化

- **重构 `loadContactsInBackground` 方法**: 采用"临时数组 + 延迟更新"策略，大幅提升后台刷新性能。
  - 加载过程中数据直接 append 到非响应式临时数组，不做对比合并。
  - 加载过程中只更新进度状态，不触发联系人列表的 Vue 响应式更新。
  - 全部加载完成后，清空 IndexedDB 并一次性全量保存。
  - 最后一次性赋值给 `contacts.value`，只触发一次界面重渲染。
- **消除去重开销**: 移除每批次的 `Set` 对比操作，直接 append 到临时数组。
- **减少 IndexedDB 操作**: 从每批次写入改为完成后一次性全量写入。
- **移除死代码**: 删除不再使用的 `background-loader.ts` 工具模块（`BackgroundLoader` 类和 `createBackgroundLoader` 函数）。
- **清理 `useCache` 参数**: 移除 `loadContactsInBackground` 中无效的 `useCache` 选项及相关调用方。

### Technical Details

- **修改**:
  - `src/stores/contact.ts` - 重构 `loadContactsInBackground` 方法
  - `src/composables/useContactAutoLoad.ts` - 移除 `useCache` 参数
  - `src/views/Contact/index.vue` - 移除 `useCache` 参数
- **删除**:
  - `src/utils/background-loader.ts` - 已不再使用的后台加载器工具

### Performance

- 减少 Vue 响应式更新次数：从每批次更新改为完成后更新 1 次
- 消除对比合并开销：直接 append，不做去重对比
- 减少 IndexedDB 事务：从多次写入改为 1 次全量写入
