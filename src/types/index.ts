/**
 * 类型定义文件
 * 定义了应用程序中使用的所有类型接口
 */

/** 支持的媒体文件类型 */
export type MediaFileType = "image" | "video";

/** 支持的图像格式 */
export type ImageFormat =
  | "jpg"
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "bmp"
  | "tiff"
  | "svg";

/** 支持的视频格式 */
export type VideoFormat =
  | "mp4"
  | "avi"
  | "mov"
  | "mkv"
  | "flv"
  | "wmv"
  | "webm"
  | "m4v"
  | "3gp";

/** 帧提取策略 */
export type FrameExtractionStrategy = "single" | "multiple" | "keyframes";

/** AI 分析结果 */
export interface AnalysisResult {
  /** 原始文件路径 */
  originalPath: string;
  /** 建议的文件名（不包含扩展名） */
  suggestedName: string;
  /** 描述内容 */
  description: string;
  /** 标签列表 */
  tags: string[];
  /** 分析时间戳 */
  timestamp: number;
  /** 文件名 */
  filename: string;
}

/** 重命名结果 */
export interface RenameResult {
  /** 原始文件路径 */
  originalPath: string;
  /** 新文件路径 */
  newPath: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 分析结果 */
  analysisResult: AnalysisResult;
}

/** 媒体文件信息 */
export interface MediaFileInfo {
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 文件扩展名 */
  extension: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件类型 */
  type: MediaFileType;
  /** 创建时间 */
  createdAt: Date;
  /** 修改时间 */
  modifiedAt: Date;
}

/** 视频帧信息 */
export interface VideoFrameInfo {
  /** 视频文件路径 */
  videoPath: string;
  /** 提取的帧图片路径列表 */
  framePaths: string[];
  /** 视频总时长（秒） */
  duration: number;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 帧率 */
  fps: number;
  /** 提取策略 */
  strategy: FrameExtractionStrategy;
}

/** 图像处理选项 */
export interface ImageProcessOptions {
  /** 压缩质量 (1-100) */
  quality: number;
  /** 最大宽度 */
  maxWidth: number;
  /** 最大高度 */
  maxHeight: number;
  /** 是否保持宽高比 */
  keepAspectRatio: boolean;
  /** 输出格式 */
  format?: ImageFormat;
}

/** 批量处理选项 */
export interface BatchProcessOptions {
  /** 每批处理的最大文件数 */
  batchSize: number;
  /** 最大 token 数量限制 */
  maxTokens: number;
  /** 是否启用并行处理 */
  parallel: boolean;
  /** 并行处理的最大线程数 */
  maxConcurrency: number;
}

/** Prompt 配置选项 */
export interface PromptConfig {
  /** 文件名字数长度限制 */
  filenameLength: number;
  /** 自定义 prompt 模板（只能自定义分析要求部分，JSON 格式部分由系统自动添加） */
  customTemplate?: string;
}

/** 应用配置 */
export interface AppConfig {
  /** Google Gemini API Key */
  api: string;
  /** 默认模型名称 */
  defaultModel: string;
  /** 图像处理选项 */
  imageProcessing: ImageProcessOptions;
  /** 批量处理选项 */
  batchProcessing: BatchProcessOptions;
  /** Prompt 配置选项 */
  promptConfig: PromptConfig;
  /** 帧提取策略 */
  frameExtractionStrategy: FrameExtractionStrategy;
  /** 临时文件目录 */
  tempDirectory: string;
  /** 是否启用详细输出和调试模式（临时选项，不持久化） */
  verbose?: boolean;
}

/** 命令行选项 */
export interface CommandOptions {
  /** 是否测试 API 连接 */
  test?: boolean;
  /** 是否测试 Spinner */
  testSpinner?: boolean;
  /** 是否启用详细输出和调试模式 */
  verbose?: boolean;
  /** 是否仅预览不实际重命名 */
  preview?: boolean;
  /** 是否强制覆盖 */
  force?: boolean;
  /** 自定义配置文件路径 */
  config?: string;
  /** 批量处理大小 */
  batchSize?: number;
  /** 输出目录 */
  output?: string;
  /** 显示支持的格式 */
  formats?: boolean;
  /** 检查依赖 */
  deps?: boolean;
  /** 重置 prompt 配置到默认值 */
  resetPrompt?: boolean;
  /** 帧提取策略 */
  frameExtractionStrategy?: FrameExtractionStrategy;
}

/** AI 分析请求 */
export interface AnalysisRequest {
  /** 图像文件路径列表 */
  imagePaths: string[];
  /** 用户提示词 */
  userPrompt?: string;
  /** 是否解析多个结果 */
  parseMultiple: boolean;
  /** 请求标识符 */
  requestId: string;
  /** 批次信息 */
  batchInfo?: {
    /** 当前批次号 */
    currentBatch: number;
    /** 总批次数 */
    totalBatches: number;
  };
}

/** 批量处理统计信息 */
export interface BatchProcessingStats {
  /** 总文件数 */
  totalFiles: number;
  /** 成功处理数 */
  successfulFiles: number;
  /** 失败处理数 */
  failedFiles: number;
  /** 总处理时间（毫秒） */
  totalProcessingTime: number;
  /** 批次统计 */
  batchStats: {
    /** 总批次数 */
    totalBatches: number;
    /** 成功批次数 */
    successfulBatches: number;
    /** 失败批次数 */
    failedBatches: number;
  };
}

/** FFmpeg 依赖检查结果 */
export interface DependencyCheckResult {
  /** 是否可用 */
  available: boolean;
  /** 版本信息 */
  version?: string;
  /** 错误信息 */
  error?: string;
  /** 安装路径 */
  path?: string;
}

/** 媒体处理批次项 */
export interface MediaBatchItem {
  /** 原始文件路径 */
  originalPath: string;
  /** 处理后的图像路径列表（图片为自身，视频为提取的帧） */
  framePaths: string[];
  /** 媒体类型 */
  mediaType: MediaFileType;
  /** 额外元数据 */
  metadata?: {
    /** 视频信息（仅视频文件） */
    videoInfo?: VideoFrameInfo;
    /** 原始文件扩展名 */
    extension: string;
  };
}

/** 媒体批量处理结果 */
export interface MediaBatchResult {
  /** 批次项 */
  batchItem: MediaBatchItem;
  /** AI 分析结果 */
  analysisResult?: AnalysisResult;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 新文件路径（重命名后） */
  newPath?: string;
}

/** 混合批量处理统计 */
export interface MixedBatchStats extends BatchProcessingStats {
  /** 图片文件数 */
  imageFiles: number;
  /** 视频文件数 */
  videoFiles: number;
  /** 总帧数 */
  totalFrames: number;
  /** 帧提取时间 */
  frameExtractionTime: number;
}

/** 临时文件清理函数类型 */
export type CleanupFunction = () => void | Promise<void>;

/** 环境变量类型定义 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Frame-Sense Google Gemini API Key */
      FRAME_SENSE_API_KEY?: string;
      /** Frame-Sense API 基础 URL */
      FRAME_SENSE_API_BASE_URL?: string;
      /** Frame-Sense 默认模型名称 */
      FRAME_SENSE_MODEL?: string;
      /** Frame-Sense 批量处理大小 */
      FRAME_SENSE_BATCH_SIZE?: string;
      /** Frame-Sense 详细输出和调试模式 */
      FRAME_SENSE_VERBOSE?: string;
      /** Frame-Sense 临时目录 */
      FRAME_SENSE_TEMP_DIR?: string;
      /** Frame-Sense 配置文件路径 */
      FRAME_SENSE_CONFIG_PATH?: string;
      /** Frame-Sense 最大并发数 */
      FRAME_SENSE_MAX_CONCURRENCY?: string;
      /** Frame-Sense 最大 Token 数量 */
      FRAME_SENSE_MAX_TOKENS?: string;
      /** Frame-Sense 图像质量 */
      FRAME_SENSE_IMAGE_QUALITY?: string;
      /** Frame-Sense 图像最大宽度 */
      FRAME_SENSE_IMAGE_MAX_WIDTH?: string;
      /** Frame-Sense 图像最大高度 */
      FRAME_SENSE_IMAGE_MAX_HEIGHT?: string;
      /** Frame-Sense 图像格式 */
      FRAME_SENSE_IMAGE_FORMAT?: string;
      /** Frame-Sense 帧提取策略 */
      FRAME_SENSE_FRAME_STRATEGY?: string;
    }
  }
}
