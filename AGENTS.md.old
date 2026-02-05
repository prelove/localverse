# Localverse OS 2.0 - AI Agent 指导文档

## 项目概述

Localverse OS 2.0 是一个运行在浏览器中的企业级内网操作系统，采用三层架构：
- **Browser 层**：HTML/CSS/JS 前端 + WASM 计算引擎
- **Local JAR 层**：本地 Java 服务（系统级操作）
- **Sync Server 层**：中心同步服务器（协作功能）

## 技术约束

### 必须遵守
- ✅ 只能使用 Java 8 或 Java 21（推荐 21）
- ✅ 只能下载 JAR/HTML/CSS/JS/WASM 文件
- ✅ 部署后完全离线运行
- ✅ 最终交付物不能包含 .exe/.bat/.sh 等可执行文件
- ✅ WASM 文件重命名为 .dat 或 .module 扩展名

### 禁止事项
- ❌ 不能使用 npm/yarn/pnpm
- ❌ 不能安装任何 CLI 工具
- ❌ 不能依赖外部网络 API
- ❌ 不能使用 Spring Boot 等重型框架

## 代码规范

### Java 代码
- 使用 Java 21 语法特性（虚拟线程、记录类等）
- 使用 java.net.http.HttpClient（非 Apache HttpClient）
- 使用 com.sun.net.httpserver.HttpServer（非 Tomcat/Jetty）
- 文件编码：UTF-8
- 缩进：4 空格

### JavaScript 代码
- ES2022+ 语法
- 使用原生 API，最小化外部依赖
- 文件编码：UTF-8
- 缩进：2 空格

### CSS 代码
- 使用 CSS 变量实现主题
- 移动端优先的响应式设计
- BEM 命名规范

## 目录结构
