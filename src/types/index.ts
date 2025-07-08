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
  imagePaths: string[];
  promptText: string;
  parseMultipleResults: boolean;
}
