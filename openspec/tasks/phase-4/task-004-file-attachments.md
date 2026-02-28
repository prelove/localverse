# Task 004: File Attachments 文件附件系统

## 任务概述

| 属性 | 值 |
|------|-----|
| 任务ID | phase4-task-004-file-attachments |
| 阶段 | Phase 4 - 质量与集成 |
| 优先级 | P3 (低) |
| 预估工时 | 8 小时 |
| 依赖 | Phase 4 Task 003 (设置中心) |
| 产出 | 文件附件服务 + Chat/Wiki/Announcement 集成 |
| 状态 | ⏳ 待开发 |

## 目标

为 Chat、Wiki、Announcement 插件提供文件/图片附件能力：
1. 图片/文件上传（通过 Local JAR 存储）
2. 图片内联预览
3. 文件下载链接
4. 附件大小限制（默认 10MB）

## 详细需求

### 1. AttachmentService 接口

- `upload(file, pluginId, refId)` - 上传文件，返回 attachment 对象
- `getAttachments(pluginId, refId)` - 获取关联附件列表
- `deleteAttachment(id)` - 删除附件
- `getUrl(id)` - 获取附件访问 URL

### 2. 数据库设计

```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,    -- 来源插件（chat/wiki/announcement）
  ref_id TEXT NOT NULL,        -- 来源条目 ID
  filename TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  storage_path TEXT NOT NULL,  -- 本地存储路径
  created_at INTEGER NOT NULL
);
```

### 3. 存储策略

- **Full 模式**: 通过 Local JAR HTTP API 存储到本地文件系统
- **Light/Pure 模式**: 转换为 base64 存储在 IndexedDB（限制 2MB）

### 4. Chat 集成

消息输入框增加附件按钮，发送图片后内联展示缩略图。

### 5. Wiki 集成

卡片编辑器支持拖拽上传图片，渲染 `![alt](attachment://id)` 语法。

## 实现步骤

### Step 1: AttachmentService 实现
### Step 2: Chat 插件集成（上传按钮 + 图片预览）
### Step 3: Wiki 插件集成（拖拽上传 + 渲染）
### Step 4: Announcement 集成（公告附图）
### Step 5: 单元测试

## 验收标准

- [ ] AttachmentService 上传/获取/删除正常工作
- [ ] Chat 消息可发送图片，内联预览
- [ ] Wiki 卡片支持图片附件渲染
- [ ] 文件大小超限有错误提示
- [ ] 三种运行模式下均可使用（存储方式不同）

## 更新记录

- 2026-02-28: 创建任务文档，规划文件附件系统开发需求与实现步骤。
