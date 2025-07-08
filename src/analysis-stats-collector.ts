import { existsSync, statSync } from "node:fs";

/**
 * 分析统计信息接口
 */
export interface AnalysisStats {
  /** 文件总数 */
  totalFiles: number;
  /** 文件总大小（字节） */
  totalSize: number;
  /** 原始文件大小（字节） */
  originalSize: number;
  /** 优化后文件大小（字节） */
  optimizedSize: number;
  /** 压缩率 */
  compressionRatio: number;
  /** 预估 token 数 */
  estimatedTokens: number;
  /** 发送数据大小（字节） */
  sentDataSize: number;
  /** 文本数据大小（字节） */
  textDataSize: number;
  /** 图片数据大小（字节） */
  imageDataSize: number;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  path: string;
  size: number;
  exists: boolean;
}

/**
 * 数据统计信息
 */
export interface DataStats {
  textSize: number;
  imageCount: number;
  imageDataSize: number;
  totalDataSize: number;
}

/**
 * 分析统计信息收集器
 * 负责收集和计算 AI 分析过程中的各种统计信息
 */
export class AnalysisStatsCollector {
  private stats: AnalysisStats;

  constructor() {
    this.stats = this.createEmptyStats();
  }

  /**
   * 创建空的统计信息
   */
  private createEmptyStats(): AnalysisStats {
    return {
      totalFiles: 0,
      totalSize: 0,
      originalSize: 0,
      optimizedSize: 0,
      compressionRatio: 0,
      estimatedTokens: 0,
      sentDataSize: 0,
      textDataSize: 0,
      imageDataSize: 0,
    };
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * 获取统计信息（深拷贝）
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * 收集文件统计信息
   */
  collectFileStats(filePaths: string[]): FileStats[] {
    const fileStats: FileStats[] = [];
    let totalSize = 0;

    for (const path of filePaths) {
      const exists = existsSync(path);
      const size = exists ? statSync(path).size : 0;

      fileStats.push({ path, size, exists });
      totalSize += size;
    }

    this.stats.totalFiles = filePaths.length;
    this.stats.totalSize = totalSize;
    this.stats.originalSize = totalSize;

    return fileStats;
  }

  /**
   * 更新优化后的数据大小
   */
  updateOptimizedSize(optimizedBuffers: Buffer[]): void {
    const optimizedSize = optimizedBuffers.reduce(
      (sum, buffer) => sum + buffer.length,
      0,
    );
    this.stats.optimizedSize = optimizedSize;
    this.stats.compressionRatio = this.calculateCompressionRatio();
  }

  /**
   * 计算压缩率
   */
  private calculateCompressionRatio(): number {
    if (this.stats.originalSize === 0) return 0;
    return (
      (this.stats.originalSize - this.stats.optimizedSize) /
      this.stats.originalSize
    );
  }

  /**
   * 收集数据统计信息
   */
  collectDataStats(base64Data: string[], promptText: string): DataStats {
    const textSize = Buffer.byteLength(promptText, "utf8");
    const imageCount = base64Data.length;

    // 计算 base64 数据的实际大小（base64 编码后的字符串长度）
    const base64StringSize = base64Data.reduce(
      (sum, data) => sum + data.length,
      0,
    );

    // 计算实际的图片数据大小（base64 解码后的字节数）
    const actualImageDataSize = Math.floor(base64StringSize * 0.75);

    const totalDataSize = textSize + base64StringSize;

    const dataStats: DataStats = {
      textSize,
      imageCount,
      imageDataSize: actualImageDataSize,
      totalDataSize,
    };

    // 更新内部统计信息
    this.stats.textDataSize = textSize;
    this.stats.imageDataSize = actualImageDataSize;
    this.stats.sentDataSize = totalDataSize;

    return dataStats;
  }

  /**
   * 估算 Token 数量
   */
  estimateTokens(base64Data: string[], promptText: string): number {
    const textTokens = this.estimateTextTokens(promptText);
    const imageTokens = this.estimateImageTokens(base64Data.length);
    const totalTokens = textTokens + imageTokens;

    this.stats.estimatedTokens = totalTokens;
    return totalTokens;
  }

  /**
   * 估算文本 Token 数量
   */
  private estimateTextTokens(text: string): number {
    // 根据经验，1 token ≈ 4 个字符（英文）或 1.5 个中文字符
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = text.length - chineseCharCount;

    return Math.ceil(chineseCharCount / 1.5 + otherCharCount / 4);
  }

  /**
   * 估算图片 Token 数量
   */
  private estimateImageTokens(imageCount: number): number {
    // 根据 Google Gemini 文档，每张图片大约消耗 258 tokens
    return imageCount * 258;
  }

  /**
   * 获取格式化的统计信息
   */
  getFormattedStats(): string {
    const stats = this.stats;

    const lines = [
      `📊 统计信息:`,
      `  📁 文件数量: ${stats.totalFiles} 个`,
      `  📏 原始大小: ${this.formatBytes(stats.originalSize)}`,
    ];

    if (stats.optimizedSize > 0) {
      lines.push(`  🔧 优化后大小: ${this.formatBytes(stats.optimizedSize)}`);
      lines.push(`  📉 压缩率: ${(stats.compressionRatio * 100).toFixed(1)}%`);
    }

    if (stats.sentDataSize > 0) {
      lines.push(`  📤 发送数据: ${this.formatBytes(stats.sentDataSize)}`);
    }

    if (stats.estimatedTokens > 0) {
      lines.push(`  🔢 预估 Token: ${stats.estimatedTokens.toLocaleString()}`);
    }

    return lines.join("\n");
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * 获取详细的调试信息
   */
  getDebugInfo(): string {
    const stats = this.stats;

    return [
      `🔍 详细统计信息:`,
      `  文件统计:`,
      `    总文件数: ${stats.totalFiles}`,
      `    文件总大小: ${this.formatBytes(stats.totalSize)}`,
      `  数据统计:`,
      `    文本数据: ${this.formatBytes(stats.textDataSize)}`,
      `    图片数据: ${this.formatBytes(stats.imageDataSize)}`,
      `    发送总量: ${this.formatBytes(stats.sentDataSize)}`,
      `  优化统计:`,
      `    原始大小: ${this.formatBytes(stats.originalSize)}`,
      `    优化后: ${this.formatBytes(stats.optimizedSize)}`,
      `    压缩率: ${(stats.compressionRatio * 100).toFixed(1)}%`,
      `  Token 估算:`,
      `    预估总量: ${stats.estimatedTokens.toLocaleString()}`,
    ].join("\n");
  }
}
