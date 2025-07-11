# CLAUDE.md

使用中文回答

本文件为 Claude Code (claude.ai/code) 在此仓库中处理代码时提供指导。

## 代码组织
- 应当保持“小而美”的代码组件和架构，但保持可读性与优雅。

## 项目概述

Frame-Sense 是一个基于 AI 的智能媒体文件重命名 CLI 命令行工具，使用 TypeScript 和 Node.js 构建。该工具结合 FFmpeg 和 Google Gemini AI 模型来自动分析视频和图片内容，支持混合批量处理，并生成语义化的文件名。

### 核心功能
1. **智能媒体分析**: 支持视频帧提取和图片直接分析
2. **混合批量处理**: 统一处理图片和视频文件，优化 AI 调用效率 
3. **智能命名**: 基于内容生成语义化文件名
4. **灵活配置**: 支持自定义提示词、批次大小、文件名长度等

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
- `cli-progress` 3.12.0 - 进度条显示

### 开发工具
- `@biomejs/biome` 2.0.6 - 代码格式化和检查
- `tsx` 4.19.2 - TypeScript 执行器
- `conventional-changelog-cli` 5.0.0 - 变更日志生成
- `@types/node` 22.10.1 - Node.js 类型定义
- `@types/sharp` 0.31.1 - Sharp 类型定义
- `@types/cli-progress` 3.11.6 - CLI 进度条类型定义

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
- **用户体验**: 交互式帧策略选择，支持命令行和交互式操作

### 样式
- 主题色使用 绿色 以及类似颜色

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


## 项目架构

### 核心模块
- **cli.ts**: 主入口文件，处理命令行参数和用户交互
- **core/**: 核心功能模块
  - `ai-analyzer.ts`: AI 分析器，处理图像识别和批量处理
  - `config.ts`: 配置管理器，处理用户配置和验证，支持交互式帧策略选择
  - `media-batch-processor.ts`: 媒体批量处理器，统一处理图片和视频
  - `renamer.ts`: 智能重命名器，核心重命名逻辑
  - `video-processor.ts`: 视频处理器，处理视频帧提取，支持多种帧提取策略
  - `image-processor.ts`: 图像处理器，处理图像优化
- **utils/**: 工具函数
  - `file-utils.ts`: 文件操作工具，支持文件复制和移动
  - `progress-logger.ts`: 统一的进度和日志管理器
  - `ui-utils.ts`: UI 输出工具
  - `signal-handler.ts`: 信号处理和优雅退出
  - `prompt-utils.ts`: 提示词工具，处理 AI 提示模板
- **types/**: TypeScript 类型定义

### 数据流
1. **输入处理**: 解析命令行参数，验证文件路径，支持交互式帧策略选择
2. **文件预处理**: 识别媒体类型，提取视频帧（支持多种帧提取策略）
3. **混合批次创建**: 将图片和视频帧混合分组
4. **AI 批量分析**: 调用 Google Gemini API 进行内容识别
5. **结果处理**: 生成文件名，执行重命名或预览，支持输出到指定目录
6. **清理工作**: 清理临时文件，释放资源

## 关键特性

### 混合批量处理
- **智能分组**: MediaBatchProcessor 将图片和视频帧混合分组，最大化 AI API 使用效率
- **统一处理**: 不区分图片和视频来源，统一进行批量 AI 分析
- **资源优化**: 合理管理临时文件和内存使用

### 进度管理
- **统一日志**: progressLogger 提供统一的进度显示和日志管理
- **实时更新**: 支持动态更新进度信息，提供详细的处理状态
- **调试模式**: verbose 模式提供详细的调试信息

### 配置系统
- **持久化配置**: 使用 conf 库管理用户配置
- **环境变量支持**: 支持通过环境变量覆盖配置
- **配置验证**: 自动验证配置完整性和有效性
- **交互式帧策略选择**: 支持通过命令行交互式选择帧提取策略
- **自定义提示**: 支持用户自定义 AI 分析提示模板
- **帧提取策略**: 支持多种视频帧提取策略选择

## 常见问题

### 开发相关
- 确保安装了 FFmpeg 系统依赖
- 需要配置 Google Gemini API Key
- 使用 `npm run dev` 进行开发调试
- 使用 `npm run type-check` 检查类型错误
- 使用 `npm run lint` 进行代码质量检查

### 构建相关
- 构建输出到 `dist` 目录
- 支持 sourcemap 调试
- 自动生成类型定义文件
- 使用 tsup 进行快速构建

### 使用相关
- 大文件或大量文件处理时，建议调整批次大小
- API 调用有频率限制，避免过于频繁的请求
- 临时文件会自动清理，但异常退出时可能需要手动清理