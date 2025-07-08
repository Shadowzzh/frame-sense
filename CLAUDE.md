# CLAUDE.md

使用中文回答

本文件为 Claude Code (claude.ai/code) 在此仓库中处理代码时提供指导。

## 代码组织
- 应当保持“小而美”的代码组件和架构，但保持可读性与优雅。

## 项目概述

Frame-Sense 是一个基于 AI 的智能视频重命名 CLI 命令行工具，使用 TypeScript 和 Node.js 构建。该工具结合 FFmpeg 和 Google Gemini AI 模型来自动提取视频关键帧，分析图像内容，并生成语义化的文件名。

## 技术栈

### 核心技术
- **语言**: TypeScript 5.7.2
- **运行环境**: Node.js >=18.0.0
- **模块系统**: ES Module (ESM)
- **构建工具**: tsup 8.3.5
- **包管理**: pnpm (支持 workspace)

### 核心依赖
- `@google/genai` 1.8.0 - Google Gemini AI API
- `commander` 14.0.0 - CLI 框架
- `chalk` 5.3.0 - 终端彩色输出
- `sharp` 0.34.2 - 图像处理
- `ora` 8.1.1 - 终端加载动画
- `conf` 14.0.0 - 配置管理
- `undici` 7.11.0 - HTTP 客户端

### 开发工具
- `@biomejs/biome` 2.0.6 - 代码格式化和检查
- `tsx` 4.19.2 - TypeScript 执行器
- `conventional-changelog-cli` 5.0.0 - 变更日志生成
- `@types/node` 22.10.1 - Node.js 类型定义
- `@types/sharp` 0.31.1 - Sharp 类型定义

## 开发命令

### 构建和开发
- `npm run dev`: 开发模式运行 (使用 tsx)
- `npm run build`: 构建生产版本
- `npm run start`: 运行构建后的程序

### 代码质量检查
- `npm run lint`: 使用 Biome 进行代码检查
- `npm run lint:fix`: 自动修复代码问题
- `npm run format`: 代码格式化
- `npm run type-check`: TypeScript 类型检查 (tsc --noEmit)

### 其他命令
- `npm run changelog`: 生成变更日志
- `npm run pub`: 发布到 npm 公共仓库

## 开发约定

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 Biome 代码规范 (2空格缩进，80字符行宽)
- 使用 ES 模块 (ESM)
- 所有导出使用命名导出

### 架构原则
- **模块化设计**: 清晰的分层架构，核心功能模块独立
- **类型安全**: 完整的 TypeScript 类型定义
- **错误处理**: 统一的错误处理机制和友好的错误信息
- **路径别名**: 支持 `@/` 前缀的路径别名

### 文件命名
- 使用 kebab-case 命名文件
- 类型定义文件放在 `types/` 目录
- 工具函数放在 `utils/` 目录
- 核心功能模块放在 `src/` 根目录

## 环境要求

### 运行环境
- **Node.js**: >= 18.0.0
- **FFmpeg**: 系统依赖，用于视频处理
- **Google Gemini API Key**: 用于 AI 分析

### 开发环境
- **TypeScript**: 5.7.2
- **pnpm**: 推荐的包管理器
- **VSCode**: 推荐的开发编辑器

## 部署和分发

### 安装方式
- 提供二进制命令 `frame-sense` 和 `fren`
- 支持全局安装: `npm install -g @zhangziheng/frame-sense`
- 跨平台支持 (macOS, Linux, Windows)

### 构建产物
- `dist/cli.js` - 主执行文件 (带 shebang)
- `dist/cli.d.ts` - TypeScript 类型定义
- `dist/cli.js.map` - 源码映射文件


## 常见问题

### 开发相关
- 确保安装了 FFmpeg 系统依赖
- 需要配置 Google Gemini API Key
- 使用 `npm run dev` 进行开发调试
- 使用 `npm run type-check` 检查类型错误

### 构建相关
- 构建输出到 `dist` 目录
- 支持 sourcemap 调试
- 自动生成类型定义文件