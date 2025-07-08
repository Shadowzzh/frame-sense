/**
 * 全局类型定义
 */

/**
 * 处理结果
 */
export interface ProcessResult {
  /** 原始路径 */
  originalPath: string;
  /** 新名称 */
  newName?: string;
  /** 分析结果 */
  analysis?: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 处理上下文
 */
export interface ProcessContext {
  /** 帧提取器 */
  frameExtractor?: import("@/frame-extractor").FrameExtractor;
  /** AI 分析器 */
  aiAnalyzer: import("@/ai-analyzer").AIAnalyzer;
  /** 文件重命名器 */
  fileRenamer: import("@/file-renamer").FileRenamer;
  /** 配置选项 */
  options: import("@/config").FrameSenseOptions;
}

/**
 * 文件分类结果
 */
export interface CategorizedFiles {
  /** 图片文件 */
  imageFiles: string[];
  /** 视频文件 */
  videoFiles: string[];
}

/**
 * AI 分析器相关类型
 */
export interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface OptimizedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  compressed: boolean;
}

export interface AnalysisRequest {
  /** 待分析的图像文件路径数组 */
  imagePaths: string[];

  /** 传递给 AI 的提示词文本 */
  promptText: string;

  /** 是否需要解析多个结果（批量分析） */
  parseMultipleResults: boolean;

  /** 请求的唯一标识符 */
  requestId?: string;

  /** 分析优先级 */
  priority?: "low" | "normal" | "high";

  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * AI 分析响应接口
 *
 * 定义 AI 分析器返回的响应数据结构，包括分析结果、
 * 统计信息和元数据等。
 *
 * @interface AnalysisResponse
 */
export interface AnalysisResponse {
  /** 分析结果文本 */
  result: string;

  /** 分析是否成功 */
  success: boolean;

  /** 错误信息（如果分析失败） */
  error?: string;

  /** 响应时间（毫秒） */
  responseTime?: number;

  /** 使用的 AI 模型名称 */
  model?: string;

  /** 输入令牌数量 */
  inputTokens?: number;

  /** 输出令牌数量 */
  outputTokens?: number;
}

/**
 * 批量处理统计接口
 *
 * 记录批量处理操作的统计信息，用于性能监控和调试。
 *
 * @interface BatchStats
 */
export interface BatchStats {
  /** 总批次数 */
  totalBatches: number;

  /** 成功批次数 */
  successfulBatches: number;

  /** 失败批次数 */
  failedBatches: number;

  /** 总处理时间（毫秒） */
  totalProcessingTime: number;

  /** 平均批次处理时间（毫秒） */
  averageBatchTime: number;

  /** 最大批次大小 */
  maxBatchSize: number;

  /** 总处理文件数 */
  totalFiles: number;
}

/**
 * 会话信息接口
 *
 * 记录 AI 分析器会话的详细信息，用于跟踪和调试。
 *
 * @interface SessionInfo
 */
export interface SessionInfo {
  /** 会话唯一标识符 */
  sessionId: string;

  /** 会话开始时间戳 */
  startTime: number;

  /** 是否已初始化 */
  initialized: boolean;

  /** 成功分析次数 */
  successCount: number;

  /** 错误分析次数 */
  errorCount: number;

  /** 最后一次分析结果 */
  lastAnalysisResult: string | null;

  /** 会话运行时间（毫秒） */
  uptime: number;
}

// ===== 错误处理相关类型定义 =====

/**
 * Frame-Sense 错误类型枚举
 *
 * 定义项目中可能出现的各种错误类型，用于错误分类和处理。
 */
export enum FrameSenseErrorType {
  /** 配置错误 */
  CONFIG_ERROR = "CONFIG_ERROR",

  /** 文件系统错误 */
  FILE_ERROR = "FILE_ERROR",

  /** AI 分析错误 */
  AI_ERROR = "AI_ERROR",

  /** 视频处理错误 */
  VIDEO_ERROR = "VIDEO_ERROR",

  /** 图像处理错误 */
  IMAGE_ERROR = "IMAGE_ERROR",

  /** 网络错误 */
  NETWORK_ERROR = "NETWORK_ERROR",

  /** 未知错误 */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Frame-Sense 自定义错误接口
 *
 * 扩展标准 Error 对象，添加错误类型和上下文信息。
 *
 * @interface FrameSenseError
 */
export interface FrameSenseError extends Error {
  /** 错误类型 */
  type: FrameSenseErrorType;

  /** 错误代码 */
  code?: string;

  /** 错误上下文信息 */
  context?: Record<string, unknown>;

  /** 原始错误对象 */
  originalError?: Error;

  /** 是否可重试 */
  retryable?: boolean;
}

// ===== 工具函数类型定义 =====

/**
 * 进度回调函数类型
 *
 * 用于报告处理进度的回调函数接口。
 */
export type ProgressCallback = (progress: {
  /** 当前进度（0-100） */
  percentage: number;

  /** 当前处理的文件 */
  currentFile?: string;

  /** 已处理文件数 */
  processedCount: number;

  /** 总文件数 */
  totalCount: number;

  /** 预估剩余时间（毫秒） */
  estimatedTimeRemaining?: number;
}) => void;

/**
 * 日志级别枚举
 *
 * 定义日志输出的不同级别。
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 配置验证结果接口
 *
 * 配置验证操作的结果。
 */
export interface ConfigValidationResult {
  /** 验证是否通过 */
  valid: boolean;

  /** 验证错误信息 */
  errors: string[];

  /** 验证警告信息 */
  warnings: string[];
}

// ===== 类型工具和泛型 =====

/**
 * 可选字段类型工具
 *
 * 将接口中的指定字段设为可选。
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 必需字段类型工具
 *
 * 将接口中的指定字段设为必需。
 */
export type RequiredFields<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

/**
 * 深度只读类型工具
 *
 * 递归地将对象的所有属性设为只读。
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
