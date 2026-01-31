# Localverse OS 2.0 - 项目概述

## 项目愿景

构建一个运行在浏览器中的企业级内网操作系统，实现：
- **Notion + Obsidian + Roam Research** 的知识管理能力
- **Postman + Mock Server** 的 API 开发能力
- **Everything** 的文件搜索能力
- **Slack/Teams** 的团队协作能力
- **完全离线、零部署、数据私有**的特性

## 核心特性

### 1. 三层架构
- **Browser 层**：UI 渲染、轻量计算、离线存储
- **Local JAR 层**：系统级操作、文件监视、硬件接口
- **Sync Server 层**：多人协作、数据同步、集中管理

### 2. 优雅降级
- 完整模式：Browser + WASM + Local JAR + Sync Server
- 轻量模式：Browser + WASM（无 JAR）
- 纯净模式：Browser only（无 WASM）
- 移动模式：Browser + Sync Server（直连）

### 3. 离线优先
- 所有操作先写入本地
- 后台同步，网络恢复后自动补发
- 冲突智能检测和解决

### 4. 插件化
- 70+ 可热插拔的功能模块
- 统一的插件 API
- 独立的数据隔离

## 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端 | HTML5 + CSS3 + ES2022 | 原生技术，无框架依赖 |
| 计算 | WebAssembly | SQLite、加密、压缩等 |
| 本地服务 | Java 21 | 系统级操作 |
| 通信 | WebSocket + SSE + HTTP | 五级降级 |
| 存储 | SQLite + IndexedDB | 结构化数据 |
| 缓存 | Service Worker | 离线资源 |

## 开发阶段

| 阶段 | 周期 | 目标 |
|------|------|------|
| Phase 0 | Week 1 | 基础设施（launcher、通信、存储） |
| Phase 1 | Week 2-3 | 核心应用（Finder、Wiki、FileManager） |
| Phase 2 | Week 4-5 | Sync Server + 基础协作 |
| Phase 3 | Week 6-7 | 生产力工具（IDE、Dashboard、MockMan） |
| Phase 4 | Week 8-9 | 学习工具 + 高级协作 |
| Phase 5 | Week 10-11 | AI 增强 + 优化 |
| Phase 6 | Week 12 | 测试 + 发布 |

## 交付物
