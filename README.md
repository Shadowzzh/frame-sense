# Frame-Sense

<div align="center">

[![npm](https://img.shields.io/npm/v/@zhangziheng/frame-sense)](https://www.npmjs.com/package/@zhangziheng/frame-sense)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.7.2-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🎯 **智能媒体文件重命名工具** - 基于 AI 的视频和图片文件自动语义化命名

</div>

Frame-Sense 是一个基于 AI 的智能命令行工具，结合 FFmpeg 和 Google Gemini AI 模型，自动分析视频和图片内容，生成语义化的文件名。支持批量处理、混合媒体类型处理，让文件管理变得更加智能和高效。

## ✨ 主要特性

- 🎯 **AI 自动重命名** - 基于图像内容生成语义化文件名
- 📹 **视频 + 图片支持** - 自动提取视频帧，统一处理所有媒体文件
- ⚡ **批量处理** - 一次性处理整个目录，支持混合媒体类型
- 👀 **预览模式** - 先预览重命名结果，确认无误后再执行
- 🔧 **自定义配置** - 支持自定义 AI 提示词、批次大小、文件名长度
- 📁 **输出目录** - 可指定输出目录，避免覆盖原文件

## 📦 安装

### 全局安装
```bash
npm install -g @zhangziheng/frame-sense
```

## 🚀 快速开始

### 1. 配置 API Key
首次使用需要配置 Google Gemini API Key：

```bash
frame-sense config --api YOUR_GEMINI_API_KEY
```

API 注册地址：[Google Al Studio API](https://aistudio.google.com/apikey)

### 2. 处理单个文件
```bash
# 分析视频文件
frame-sense video.mp4

# 分析图片文件
frame-sense image.jpg

# 预览重命名结果（不实际重命名）
frame-sense video.mp4 --preview
```

### 3. 批量处理目录
```bash
# 处理目录中的所有媒体文件（自动识别为目录）
frame-sense /path/to/media/folder

# 预览批量重命名结果
frame-sense /path/to/media/folder --preview

# 指定输出目录
frame-sense /path/to/media/folder --output /path/to/output
```


### 使用示例

#### 基础使用
```bash
# 分析单个视频文件
frame-sense vacation.mp4

# 预览重命名结果
frame-sense vacation.mp4 --preview

# 批量处理目录（自动识别）
frame-sense ./photos

# 输出到指定目录
frame-sense ./videos --output ./renamed_videos
```

#### 高级配置
```bash
# 设置自定义提示模板
frame-sense config --custom-prompt "请详细描述这个图像的主要内容，包括人物、场景和动作"

# 设置文件名长度限制为20个字符
frame-sense config --filename-length 20

# 设置批处理大小为10
frame-sense config --batch-size 10

# 启用详细输出模式
frame-sense ./media --verbose
```

#### 系统检查
```bash
# 检查 API 连接
frame-sense --test

# 检查系统依赖（FFmpeg）
frame-sense --deps

# 查看支持的格式
frame-sense --formats

# 查看当前配置
frame-sense --config
```

## 🔧 命令详解

### 主命令
```bash
frame-sense [文件路径] [选项]
```

#### 选项说明
- `-p, --preview` - 预览重命名结果，不实际执行
- `-o, --output <dir>` - 指定输出目录
- `-b, --batch <size>` - 设置批量处理大小
- `-v, --verbose` - 启用详细输出和调试模式
- `-t, --test` - 测试 AI API 连接
- `--config` - 显示当前配置信息
- `--formats` - 显示支持的媒体格式
- `--deps` - 检查系统依赖

> **注意**: 程序会自动判断输入路径是文件还是目录，无需指定 `-d` 选项。

### 配置管理
```bash
frame-sense config [选项]
```

#### 配置选项
- `--api <key>` - 设置 Google Gemini API Key
- `--batch-size <size>` - 设置默认批量处理大小
- `--filename-length <length>` - 设置文件名字符长度限制
- `--custom-prompt <template>` - 设置自定义分析提示模板
- `--reset-prompt` - 重置提示模板到默认值
- `--reset` - 重置所有配置到默认值


## 📊 支持的格式

### 图片格式
- **JPEG/JPG** - 通用图片格式
- **PNG** - 无损压缩图片
- **GIF** - 动图支持
- **WebP** - 现代图片格式
- **BMP** - 位图格式
- **TIFF** - 高质量图片
- **SVG** - 矢量图形

### 视频格式
- **MP4** - 通用视频格式
- **AVI** - 经典视频格式
- **MOV** - Apple 视频格式
- **MKV** - 开源视频容器
- **FLV** - Flash 视频
- **WMV** - Windows 媒体视频
- **WebM** - Web 视频格式
- **M4V** - iTunes 视频
- **3GP** - 移动设备视频

## ⚙️ 系统要求

### 运行环境
- **Node.js**: >= 18.0.0
- **FFmpeg**: 用于视频处理（必需）
- **Google Gemini API Key**: 用于 AI 分析

### 依赖安装

#### macOS (使用 Homebrew)
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows (使用 Chocolatey)
```bash
choco install ffmpeg
```

#### 验证安装
```bash
frame-sense --deps
```

## 🔧 配置详解

### 环境变量
你也可以通过环境变量来配置 Frame-Sense：

```bash
export FRAME_SENSE_API_KEY="your_gemini_api_key"
export FRAME_SENSE_BATCH_SIZE="8"
export FRAME_SENSE_VERBOSE="true"
export FRAME_SENSE_TEMP_DIR="/tmp/frame-sense"
export FRAME_SENSE_MAX_CONCURRENCY="4"
```

### 配置文件
配置文件自动保存在用户配置目录中：
- **macOS**: `~/Library/Preferences/frame-sense-nodejs/`
- **Linux**: `~/.config/frame-sense-nodejs/`
- **Windows**: `%APPDATA%/frame-sense-nodejs/`

## 🎯 工作原理

### 图片处理流程
1. **文件验证** - 检查文件格式和完整性
2. **图像预处理** - 压缩和格式标准化
3. **AI 分析** - 调用 Google Gemini 进行内容识别
4. **文件重命名** - 根据分析结果生成新文件名

### 视频处理流程
1. **视频分析** - 获取视频元信息（时长、分辨率等）
2. **帧提取策略** - 根据配置选择合适的帧提取方式
3. **帧预处理** - 优化图像质量和尺寸
4. **批量 AI 分析** - 将提取的帧发送给 AI 进行分析
5. **结果聚合** - 合并多帧分析结果
6. **文件重命名** - 生成语义化的视频文件名
7. **临时文件清理** - 自动清理提取的帧文件

#### 帧提取策略详解

Frame-Sense 提供三种不同的帧提取策略，适应不同的使用场景：

| 策略 | 说明 | 适用场景 | 优势 | 注意事项 |
|------|------|----------|------|----------|
| **single** | 提取第10帧作为代表帧 | 快速预览、简单内容视频 | 处理速度快、资源占用少 | 可能错过重要内容变化 |
| **multiple** | 均匀提取5帧覆盖整个视频 | 一般视频内容、教程视频 | 内容覆盖全面、结果可控 | 处理时间适中 |
| **keyframes** | 提取所有关键帧（场景变化点） | 复杂场景、动作密集视频 | 捕获所有重要场景变化 | 提取帧数不可控、耗时较长 |

**配置帧提取策略：**

通过配置文件设置（推荐）：
```bash
# 查看当前配置
frame-sense --config

# 手动编辑配置文件，修改 frameExtractionStrategy 字段：
# ~/.config/frame-sense-nodejs/frame-sense.json
{
  "frameExtractionStrategy": "multiple"  // 可选：single, multiple, keyframes
}
```

程序化设置：
```typescript
import { getConfigManager } from '@/core/config';

const config = getConfigManager();
config.setFrameExtractionStrategy('keyframes');
```

**策略选择建议：**
- 📷 **日常视频、Vlog** → `single`（快速处理）
- 🎬 **电影、长视频** → `multiple`（全面覆盖）
- 🎮 **游戏录像、运动视频** → `keyframes`（捕获动作变化）
- 📚 **教程、演示视频** → `multiple`（平衡效果与速度）

### 混合批处理优化
- **智能分组**: 将图片和视频帧混合分组，最大化 AI API 使用效率
- **并行处理**: 支持多文件同时处理，提升整体速度
- **内存管理**: 合理管理临时文件和内存使用
- **错误恢复**: 单个文件失败不影响整体处理进程

## 🚨 注意事项

### API 使用限制
- Google Gemini API 有调用频率限制
- 建议合理设置批处理大小，避免超出限制
- 大量文件处理时建议分批进行

### 性能优化建议
- 对于大量文件，建议使用 `--batch-size` 参数调整批处理大小
- 视频文件处理相对较慢，因为需要提取帧
- 启用 `--verbose` 模式可以查看详细的处理信息

### 数据安全
- 图像数据会发送到 Google Gemini API 进行分析
- 不会永久存储用户的图像数据



## 技术栈
- **TypeScript** - 类型安全的 JavaScript
- **Node.js** - 运行时环境
- **Commander.js** - CLI 框架
- **Sharp** - 图像处理
- **Google Gemini API** - AI 内容分析
- **FFmpeg** - 视频处理
- **Chalk** - 终端样式
- **Ora** - 进度指示器

## 🌟 致谢

- [Google Gemini AI](https://ai.google.dev/) - 提供强大的图像识别能力（主要是免费😅）
- [FFmpeg](https://ffmpeg.org/) - 视频处理核心
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能图像处理

---

<div align="center">

**让文件管理变得更智能** 🚀

[GitHub](https://github.com/Shadowzzh/frame-sense) • [NPM](https://www.npmjs.com/package/@zhangziheng/frame-sense) • [Issues](https://github.com/Shadowzzh/frame-sense/issues)

</div>