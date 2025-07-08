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
- `cli-progress` 3.12.0 - 进度条显示
- `undici` 7.11.0 - HTTP 客户端

### 开发工具
- `@biomejs/biome` 2.0.6 - 代码格式化和检查
- `tsx` 4.19.2 - TypeScript 执行器
- `conventional-changelog-cli` 5.0.0 - 变更日志生成
- `@types/cli-progress` 3.11.6 - 进度条类型定义
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

## 项目架构

```
src/
├── cli.ts                      # CLI 入口文件
├── ai-analyzer.ts              # AI 分析器
├── analysis-stats-collector.ts # 分析统计收集器
├── config.ts                   # 配置管理
├── constants.ts                # 常量定义
├── errors.ts                   # 错误处理
├── file-processor.ts           # 文件处理器
├── file-renamer.ts             # 文件重命名器
├── file-scanner.ts             # 文件扫描器
├── frame-extractor.ts          # 视频帧提取器
├── processor.ts                # 主处理器
├── prompts.ts                  # AI 提示词
├── welcome.ts                  # 欢迎界面
├── types/                      # TypeScript 类型定义
│   └── index.ts
└── utils/                      # 工具函数
    ├── ffmpeg-checker.ts       # FFmpeg 依赖检查
    ├── logger.ts               # 日志管理
    ├── result-formatter.ts     # 结果格式化
    ├── signal-handler.ts       # 信号处理
    └── stats-collector.ts      # 统计收集器
```

## 核心功能

### 1. 智能图像分析
- **批量处理**: 支持批量处理图片和视频文件
- **图片优化**: 自动图片压缩优化，根据文件大小和尺寸决定是否压缩
- **多格式支持**: 支持多种媒体格式

### 2. 视频帧提取
- **FFmpeg 集成**: 使用 FFmpeg 提取视频关键帧
- **依赖检查**: 自动检查 FFmpeg 和 FFprobe 可用性
- **多种策略**: 支持不同的帧提取策略
- **自动清理**: 自动清理临时文件

### 3. 智能重命名
- **语义化命名**: 基于内容分析生成有意义的文件名
- **结构化命名**: 支持时间序列等结构化命名
- **冲突处理**: 自动处理文件名冲突和去重

### 4. 配置管理
- **多层配置**: 支持命令行参数、配置文件和环境变量
- **类型安全**: 完整的 TypeScript 类型定义
- **用户友好**: 提供配置命令进行交互式配置

### 5. 用户界面
- **彩色输出**: 使用 chalk 提供友好的终端输出
- **进度指示**: 使用 ora 显示加载动画和进度
- **进度条**: 使用 cli-progress 显示批量处理进度
- **统计信息**: 详细的处理统计和结果展示
- **日志管理**: 统一的日志输出和调试信息

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

## 项目状态

- **版本**: 0.0.3 (持续迭代中)
- **开发状态**: 活跃开发中
- **功能完整性**: 核心功能已实现，性能优化持续进行
- **代码质量**: 高质量的 TypeScript 代码，完整的类型定义
- **发布状态**: 已发布到 npm 公共仓库

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