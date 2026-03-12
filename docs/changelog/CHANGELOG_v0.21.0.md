# Changelog

## [0.21.0] - 2026-03-12

### Added

#### 会话级图片预览串行浏览

- `ImageViewer` 支持图片列表与初始索引输入，可在预览弹层中进行上一张/下一张切换。
- 新增键盘切图能力：`←/→` 用于切换图片，`ESC` 关闭预览。
- 保留并兼容缩放、旋转、下载等既有预览工具能力。

#### 渐进式图片加载状态可视化

- 默认优先显示低清预览图（缩略图），后台加载高清图，加载成功后自动替换。
- 新增预览质量标识（预览小图 / 高清图）与高清加载状态（加载中 / 加载失败）提示。

### Changed

- 图片与视频点击行为进一步收敛为站内预览优先，避免不必要的新窗口跳转。
- 消息类型配置增加图片预览序列参数透传能力（图片列表与初始索引）。

### Technical Details

- **修改文件**:
  - `src/components/common/ImageViewer.vue` - 串行浏览、键盘切图、渐进式加载与状态提示
  - `src/components/chat/MessageBubble.vue` - 预览点击职责收敛与会话图片序列接入
  - `src/components/chat/message-types/ImageMessage.vue` - 透传图片列表与初始索引
  - `src/components/chat/message-types/config.ts` - 图片消息 props 映射扩展

### Notes

- `v0.21.0` 变更基于 `v0.20.x` 的历史加载优化继续演进，重点提升媒体预览体验与一致性。
