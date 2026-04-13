# Changelog

## [0.24.0] - 2026-04-13

### Added

#### 收藏消息类型支持

- 新增对 `type=49, subType=24` 收藏消息的识别能力，不再回退为通用未知消息。
- 新增收藏消息卡片组件，支持在消息气泡中展示收藏标题、摘要、内容数量与内容类型标签。
- 新增收藏消息详情弹窗，按收藏内容块顺序展示文本、图片、视频、文件、位置与链接等条目。

#### 富文本消息兜底能力增强

- 为未知 `type=49` 子类型补充类型级 fallback，未单独适配的富文本消息也能显示为“富文本消息”而不是彻底失语。
- 扩展消息类型校验用例，覆盖收藏消息配置查找。

### Changed

#### 收藏摘要与详情语义优化

- 收藏消息摘要改为优先从 `recordInfo.DataList.DataItems` 生成，而不是依赖经常为空的 `title` / `desc` 字段。
- 针对 `msgtype-fav.md` 真实样本中的 `WeNoteHtmlFile` / `DataFmt=htm` 结构，将收藏内的 HTML 文件条目标记为“收藏笔记”。
- 收藏详情展示弱化了转发聊天记录中的“发送者 / 时间 / 头像”语义，遇到缺失来源字段时仍可正常浏览内容块。

#### 工程依赖升级

- 升级 `vite` 相关依赖，继续保持构建链路与开发体验更新。
- 升级 `axios` 依赖，跟进基础网络库的补丁更新。

### Technical Details

- **新增文件**:
  - `src/components/chat/message-types/FavoriteMessage.vue` - 收藏消息卡片组件
  - `src/components/chat/message-types/FavoriteDialog.vue` - 收藏消息详情弹窗
- **修改文件**:
  - `src/types/message.ts` - 增加 `RichMessageSubType.Favorite = 24` 及名称/图标映射
  - `src/components/chat/composables/useMessageType.ts` - 增加收藏消息类型判断
  - `src/components/chat/composables/useMessageUrl.ts` - 新增基于 `DataItems` 的收藏摘要与内容块提取逻辑
  - `src/components/chat/message-types/config.ts` - 接入收藏消息配置，并为 `type=49` 添加通用 fallback
  - `src/components/chat/MessageBubble.vue` - 接入收藏消息组件与详情弹窗交互
  - `src/components/chat/message-types/registry.ts` / `index.ts` - 注册并导出收藏消息组件
  - `src/components/chat/message-types/__test-config__.ts` - 增加收藏消息配置校验样例

### User Experience

- 收藏消息现在可以直接在聊天流中识别和阅读，不再只能看到“未知消息类型”。
- 用户可以从收藏卡片快速进入详情视图，按真实收藏顺序浏览文本与媒体内容。
- 即使未来继续出现新的 `type=49` 子类型，基础可读性也比之前更稳定。

### Notes

- 本版本基于 `v0.23.0` 之后的提交整理，包含收藏消息支持与依赖升级。
- 收藏消息实现显式参照了 `chatlog-session-docs/api/examples/msgtype-fav.md` 的真实样本结构。
