# Changelog

## [0.16.0] - 2025-02-11

### Added

#### 聊天记录导出功能

- **导出对话框**: 新增 `ChatExportDialog.vue` 组件，提供完整的导出配置界面。
  - 支持三种导出格式：JSON、CSV、TXT。
  - 支持时间范围选择：全部消息、最近7天、最近30天、自定义日期范围。
  - 支持消息类型筛选：全部类型、仅文本消息、包含媒体引用。
  - 实时显示导出进度，支持取消操作。
- **多格式导出**:
  - **JSON 格式**: 导出结构化数据，包含完整的消息信息（时间、发送者、内容、媒体等）。
  - **CSV 格式**: 导出为表格格式，便于 Excel 分析处理。
  - **TXT 格式**: 导出为纯文本格式，便于阅读和分享。
- **进度追踪**: 大批量导出时显示实时进度条、已处理消息数和预计剩余时间。
- **取消功能**: 导出过程中可随时取消，使用 AbortController 优雅中止请求。
- **批量导出**: 支持分页获取（每页500条），避免内存溢出和请求超时。

#### 设置页面数据导出

- **全量数据导出**: 设置页面的"导出数据"按钮现已可用。
  - 支持导出所有会话的聊天记录。
  - 支持选择导出格式（JSON/CSV/TXT）。
  - 显示导出进度 loading 提示。

#### 文件下载工具

- **新增 `download.ts` 工具模块**:
  - `downloadFile()`: 通用文件下载函数，支持 Blob 和字符串内容。
  - `downloadJSON()`: JSON 数据下载，自动格式化。
  - `downloadText()`: 文本内容下载。
  - `downloadCSV()`: CSV 文件下载，自动添加 BOM 支持中文。
  - `formatFileSize()`: 文件大小格式化显示。

#### API 增强

- **新增 `exportWithProgress()` 方法**: 支持带进度回调和取消功能的聊天记录导出。
  - 分页获取大数据量消息，避免请求超时。
  - 支持 AbortController 信号，可取消正在进行的导出。
  - 实时回调进度信息（current/total）。

### Technical Details

- **新增组件**:
  - `src/components/chat/ChatExportDialog.vue` - 导出对话框组件
  - `src/utils/download.ts` - 文件下载工具函数
- **API 扩展**: `src/api/chatlog.ts` 新增 `exportWithProgress()` 方法
- **状态管理**: 集成 `isExporting` 状态，支持 beforeunload 事件拦截
- **类型定义**: 新增 `ExportFormat`、`ExportStage`、`TimeRangeType` 等类型

### User Experience

- **一键导出**: 在聊天界面点击"更多操作" → "导出聊天记录"即可开始导出。
- **灵活配置**: 可选择导出格式、时间范围、消息类型，满足不同场景需求。
- **进度可见**: 大批量导出不再"黑盒"，用户可实时了解导出进度。
- **安全提醒**: 导出过程中关闭页面会提示确认，防止误操作导致数据丢失。
- **跨平台支持**: 导出功能支持桌面端和移动端浏览器。

### Files Changed

- **新增**:
  - `src/components/chat/ChatExportDialog.vue`
  - `src/utils/download.ts`
- **修改**:
  - `src/api/chatlog.ts` - 添加 exportWithProgress 方法
  - `src/views/Chat/index.vue` - 集成导出对话框
  - `src/views/Settings/index.vue` - 实现数据导出功能

### Notes

- CSV 格式导出由后端处理，确保特殊字符正确转义。
- JSON 和 TXT 格式在客户端生成，减少服务器负载。
- 大批量导出（>5000条消息）建议分批或缩小时间范围。
- 移动端导出文件会自动下载到默认下载目录。
