# 🎬 Frame Sense (帧意命名)

<div align="center">

![Frame Sense](https://img.shields.io/badge/Frame%20Sense-帧意命名-blue?style=for-the-badge&logo=video&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange?style=for-the-badge&logo=googlegemini&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)

**一个结合 FFmpeg 和 Google Gemini AI 的智能视频重命名工具**

*让你的视频文件名具有语义化含义，告别乱七八糟的文件名！*

</div>

## ✨ 功能特性

- 🎞️ **关键帧提取** - 利用 FFmpeg 自动从视频中提取最具代表性的关键帧
- 🧠 **AI 语义理解** - 集成 Google Gemini AI 模型，深度理解图像内容
- ⚡ **批量处理** - 支持单文件或批量处理文件夹下的所有视频和图片文件
- 🎨 **多种命名格式** - 支持语义主导型和结构化格式两种命名方式

## 📦 安装

### 前置要求

- **Node.js** >= 18.0.0
- **FFmpeg** (用于视频关键帧提取)
- **Google Gemini API Key**

### 安装 FFmpeg

<details>
<summary>🍎 macOS (Homebrew)</summary>

```bash
brew install ffmpeg
```
</details>

<details>
<summary>🐧 Ubuntu/Debian</summary>

```bash
sudo apt update
sudo apt install ffmpeg
```
</details>

<details>
<summary>🪟 Windows</summary>

下载并安装 FFmpeg: https://ffmpeg.org/download.html
</details>

### 安装 Frame Sense

```bash
# 使用 npm 安装
npm install -g @zhangziheng/frame-sense

# 使用 pnpm 安装
pnpm install -g @zhangziheng/frame-sense
```

## 🚀 快速开始

### 1. 获取 API Key

访问 [Google AI Studio](https://ai.google.dev/) 获取免费的 Gemini API Key。

### 2. 配置 API Key

```bash
# 使用配置命令
frame-sense config set apiKey your_api_key_here
```

### 3. 开始使用

```bash
# 处理单个文件
frame-sense -f video.mp4

# 处理整个目录
frame-sense -d ./videos

# 预览重命名结果（不实际重命名）
frame-sense -d ./videos --dry-run

# 使用结构化命名格式
frame-sense -d ./videos --format structured

# 提取更多关键帧
frame-sense -d ./videos --frames 2
```

## 📖 命令行选项

```
Usage: frame-sense [options]

基于 AI 的智能视频重命名 CLI 工具

Options:
  -V, --version                  输出版本号
  -d, --directory <path>         指定要处理的目录
  -f, --files <files...>         指定要处理的文件列表
  --frames <number>              每个视频提取的关键帧数量 (默认: 2)
  --format <format>              命名格式 (semantic|structured) (默认: semantic)
  --dry-run                      预览重命名结果，不执行实际重命名
  -h, --help                     显示帮助信息

子命令:
  config                         配置管理
```

## 🎯 命名格式

### 语义主导型 (Semantic) 🎨
适合按内容分类管理：

```
<内容关键词>-<动作或主题>.mp4
```

**示例：**
- `猫咪-玩耍.mp4`
- `风景-日落.jpg`
- `会议-讨论.mp4`

### 结构化格式 (Structured) 📋
适合时间排序和自动化处理：

```
<YYYYMMDD>-<关键词>-<序号>.mp4
```

**示例：**
- `20241204-猫咪玩耍-1.mp4`
- `20241204-风景日落-2.jpg`
- `20241204-会议讨论-3.mp4`

## 📁 支持的文件格式

<div align="center">

| 视频格式 | 图片格式 |
|---------|---------|
| `.mp4` `.avi` `.mov` `.mkv` | `.jpg` `.jpeg` `.png` `.gif` |
| `.webm` `.m4v` `.flv` `.wmv` | `.bmp` `.webp` `.tiff` |

</div>

## ⚙️ 配置管理

Frame Sense 提供了完整的配置管理功能：

```bash
# 配置向导
frame-sense config

# 查看当前配置
frame-sense config show

# 重置配置
frame-sense config reset
```

配置文件位置：
- macOS: `~/Library/Preferences/frame-sense-nodejs/config.json`
- Linux: `~/.config/frame-sense-nodejs/config.json`
- Windows: `%APPDATA%\frame-sense-nodejs\config.json`

## 🛠️ 开发

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/Shadowzzh/frame-sense.git
cd frame-sense

# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm type-check
```

### 项目结构

```
frame-sense/
├── src/
│   ├── cli.ts                  # CLI 入口文件
│   ├── cli/                    # CLI 相关模块
│   │   ├── commands/           # 命令定义
│   │   ├── handlers/           # 命令处理器
│   │   └── utils/              # CLI 工具函数
│   ├── core/                   # 核心处理模块
│   │   ├── file-processor.ts   # 文件处理器
│   │   ├── file-scanner.ts     # 文件扫描器
│   │   ├── image-processor.ts  # 图片处理器
│   │   └── video-processor.ts  # 视频处理器
│   ├── utils/                  # 工具函数
│   ├── types/                  # 类型定义
│   ├── config.ts               # 配置管理
│   ├── processor.ts            # 主处理器
│   ├── frame-extractor.ts      # 视频关键帧提取
│   ├── ai-analyzer.ts          # AI 图像分析
│   └── file-renamer.ts         # 文件重命名
├── dist/                       # 构建输出
├── docs/                       # 文档
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

## 📊 技术架构

<div align="center">

![技术架构图](assets/technical.svg)

</div>

## 🙏 致谢

- [Google Gemini AI](https://ai.google.dev/) - 提供强大的 AI 图像理解能力
- [FFmpeg](https://ffmpeg.org/) - 视频处理
- [Commander.js](https://github.com/tj/commander.js) - 命令行界面框架
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能图像处理库

## 📞 联系方式

- **作者**: zhangziheng
- **邮箱**: shadow1746556951@gmail.com
- **GitHub**: [@Shadowzzh](https://github.com/Shadowzzh)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ 支持一下！**

</div>