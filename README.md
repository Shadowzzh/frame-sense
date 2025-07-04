# Frame Sense (帧意命名)

一个结合 FFmpeg 和图像识别模型的命令行工具，用于自动提取关键帧并为视频文件生成语义化文件名。


## ✨ 功能特性

- 🎞️ **自动关键帧提取**: 利用 ffmpeg 自动从每段视频中提取最具代表性的关键帧
- 🧠 **图像语义理解**: 集成 Google Gemini AI 模型，对提取的关键帧进行内容识别与语义解析
- ⚙️ **全自动批量处理**: 支持单文件或批量处理文件夹下的所有视频和图片文件
- 🔧 **多种命名格式**: 支持语义主导型和结构化格式两种命名方式
- 🎨 **彩色终端输出**: 友好的命令行界面，支持进度条和加载动画
- ⚡ **开发友好**: 集成 TypeScript、Biome 代码规范检查工具

## 📦 安装

### 前置要求

- Node.js >= 18.0.0
- FFmpeg (用于视频关键帧提取)
- Google Gemini API Key

### 安装 FFmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
下载并安装 FFmpeg: https://ffmpeg.org/download.html

### 安装 Frame Sense

```bash
# 从源码安装
git clone https://github.com/Shadowzzh/frame-sense.git
cd frame-sense
npm install
npm run build

# 全局安装
npm link
```

## 🚀 快速开始

### 1. 获取 API Key

访问 [Google AI Studio](https://ai.google.dev/) 获取免费的 Gemini API Key。

### 2. 配置环境变量

```bash
# 复制环境变量配置文件
cp .env.example .env

# 编辑 .env 文件，添加你的 Gemini API Key
export GOOGLE_API_KEY="your_api_key_here"
```

### 3. 基本使用

```bash
# 处理单个文件
frame-sense -f video.mp4

# 处理整个目录
frame-sense -d ./videos

# 预览重命名结果（不实际重命名）
frame-sense -d ./videos --dry-run

# 使用结构化命名格式
frame-sense -d ./videos --format structured

# 显示详细日志
frame-sense -d ./videos --verbose
```

## 📖 命令行选项

```
Usage: frame-sense [options]

基于 AI 的智能视频重命名 CLI 工具

Options:
  -V, --version                  输出版本号
  -d, --directory <path>         指定要处理的目录
  -f, --files <files...>         指定要处理的文件列表
  -c, --config <path>            指定配置文件路径
  --frames <number>              每个视频提取的关键帧数量 (默认: 2)
  --format <format>              命名格式 (semantic|structured) (默认: semantic)
  --dry-run                      预览重命名结果，不执行实际重命名
  --verbose                      显示详细日志
  -h, --help                     显示帮助信息
```

## 🎯 命名格式

### 语义主导型 (Semantic)
适合按内容分类管理：
```
<内容关键词>-<动作或主题>.mp4
```
示例：
- `猫咪-玩耍.mp4`
- `风景-日落.jpg`
- `会议-讨论.mp4`

### 结构化格式 (Structured)
适合时间排序和自动化处理：
```
<YYYYMMDD>-<关键词>-<序号>.mp4
```
示例：
- `20241204-猫咪玩耍-1.mp4`
- `20241204-风景日落-2.jpg`
- `20241204-会议讨论-3.mp4`

## 📋 更新日志

### v0.0.1 (2024-07-04)
- ✨ 初始版本发布
- 🔄 升级到 `@google/genai` v1.8.0（替代原 `@google/generative-ai`）
- 🚀 支持最新的 Gemini 2.0 Flash 模型
- 🛠️ 改进的 API 调用和错误处理
- 📝 完善的类型定义和代码规范

## 🛠️ 开发

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/Shadowzzh/frame-sense.git
cd frame-sense

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

### 项目结构

```
frame-sense/
├── src/
│   ├── cli.ts              # CLI 入口文件
│   ├── config.ts           # 配置管理
│   ├── processor.ts        # 文件处理器
│   ├── frame-extractor.ts  # 视频关键帧提取
│   ├── ai-analyzer.ts      # AI 图像分析
│   └── file-renamer.ts     # 文件重命名
├── dist/                   # 构建输出
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

## 📄 支持的文件格式

### 视频格式
- .mp4, .avi, .mov, .mkv, .webm, .m4v, .flv, .wmv

### 图片格式
- .jpg, .jpeg, .png, .gif, .bmp, .webp, .tiff

## ⚙️ 配置文件

Frame Sense 支持通过配置文件自定义行为：

```json
{
  "frames": 3,
  "format": "semantic",
  "dryRun": false,
  "verbose": true,
  "apiKey": "your_api_key_here",
  "model": "gemini-2.0-flash-001"
}
```

使用配置文件：
```bash
frame-sense -c config.json -d ./videos
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Google Gemini AI](https://ai.google.dev/) - 提供强大的 AI 图像理解能力
- [FFmpeg](https://ffmpeg.org/) - 视频处理的瑞士军刀
- [Commander.js](https://github.com/tj/commander.js) - 命令行界面框架

## 📞 联系方式

- 作者: zhangziheng
- 邮箱: shadow1746556951@gmail.com
- GitHub: [@Shadowzzh](https://github.com/Shadowzzh)

---

如果这个项目对你有帮助，请给个 ⭐️ 支持一下！