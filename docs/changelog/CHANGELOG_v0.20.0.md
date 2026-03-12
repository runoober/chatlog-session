# Changelog

## [0.20.0] - 2026-03-11

### Changed

#### 历史消息探测与空窗口表达优化

- 优化历史消息加载逻辑，增强“空窗口探测”下的可持续加载体验。
- 引入相邻空窗口自动合并策略，减少重复 EmptyRange 虚拟消息，提升消息列表可读性。
- 调整顶部锚点选择优先级，优先使用虚拟消息边界继续向更早历史探测。
- 升级应用版本号到 `0.20.0`。

### Technical Details

- **修改文件**:
  - `src/components/chat/MessageList.vue` - 调整历史加载入口与锚点策略
  - `src/stores/chat.ts` - 优化 EmptyRange/Gap 相关加载流程
  - `src/stores/chat/utils.ts` - 增强空窗口合并与顺序处理工具
  - `src/types/message.ts` - 补充/调整空窗口相关类型结构
  - `package.json` - 版本号更新至 `0.20.0`

### User Experience

- 在“加载更多历史消息”过程中，遇到连续空时间窗口时反馈更清晰，且仍可继续向前探索。
- 空窗口提示更简洁，减少重复提示造成的视觉噪音。

### Notes

- 本版本主要聚焦历史加载与虚拟消息策略，不包含新的业务功能入口。
