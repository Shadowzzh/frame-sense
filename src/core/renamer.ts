/**
 * 智能重命名器
 * 提供语义化文件重命名功能，包括冲突处理和批量操作
 */

import { dirname, join } from "node:path";
import { AIAnalyzer, AIBatchProcessor } from "@/core/ai-analyzer";
import { getConfigManager } from "@/core/config";
import { MediaBatchProcessor } from "@/core/media-batch-processor";
import { VideoProcessor } from "@/core/video-processor";
import type { AnalysisResult, MixedBatchStats, RenameResult } from "@/types";
import { FileUtils } from "@/utils/file-utils";

export class SmartRenamer {
  /** AI 分析器 */
  private analyzer: AIAnalyzer;
  /** 批量处理器 */
  private batchProcessor: AIBatchProcessor;
  /** 视频处理器 */
  private videoProcessor: VideoProcessor;
  /** 媒体批量处理器 */
  private mediaBatchProcessor: MediaBatchProcessor;
  /** 重命名历史记录 */
  private renameHistory: RenameResult[] = [];

  constructor() {
    this.analyzer = new AIAnalyzer();
    this.batchProcessor = new AIBatchProcessor();
    this.videoProcessor = new VideoProcessor();
    this.mediaBatchProcessor = new MediaBatchProcessor();
  }

  /**
   * 重命名单个文件
   * @param filePath - 文件路径
   * @param outputDir - 输出目录（可选）
   * @param preview - 是否仅预览
   * @returns 重命名结果
   */
  public async renameSingleFile(
    filePath: string,
    outputDir?: string,
    preview = false,
  ): Promise<RenameResult> {
    const config = getConfigManager();

    // 获取文件信息
    const fileInfo = FileUtils.getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`无法获取文件信息: ${filePath}`);
    }

    if (config.isVerboseMode()) {
      console.log(`开始分析文件: ${filePath}`);
    }

    try {
      let analysisResult: AnalysisResult;

      if (fileInfo.type === "image") {
        // 直接分析图像
        analysisResult = await this.analyzer.analyzeImage(filePath);
      } else if (fileInfo.type === "video") {
        // 提取视频帧后分析
        analysisResult = await this.analyzeVideo(filePath);
      } else {
        throw new Error(`不支持的文件类型: ${fileInfo.type}`);
      }

      // 生成新的文件路径
      const targetDir = outputDir || dirname(filePath);
      const newFilePath = this.generateNewFilePath(
        targetDir,
        analysisResult.suggestedName,
        fileInfo.extension,
      );

      // 如果是预览模式，不执行实际重命名
      if (preview) {
        return {
          originalPath: filePath,
          newPath: newFilePath,
          success: true,
          analysisResult,
        };
      }

      // 执行重命名
      const success = FileUtils.renameFile(filePath, newFilePath);

      const result: RenameResult = {
        originalPath: filePath,
        newPath: newFilePath,
        success,
        analysisResult,
        error: success ? undefined : "重命名失败",
      };

      // 记录到历史
      this.renameHistory.push(result);

      if (config.isVerboseMode()) {
        console.log(
          `文件重命名${success ? "成功" : "失败"}: ${filePath} -> ${newFilePath}`,
        );
      }

      return result;
    } catch (error) {
      const result: RenameResult = {
        originalPath: filePath,
        newPath: filePath,
        success: false,
        analysisResult: {
          originalPath: filePath,
          suggestedName: "error",
          description: "分析失败",
          tags: [],
          timestamp: Date.now(),
          filename: "error",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.renameHistory.push(result);
      return result;
    }
  }

  /**
   * 批量重命名文件（新版本 - 支持视频批量处理）
   * @param filePaths - 文件路径列表
   * @param outputDir - 输出目录（可选）
   * @param preview - 是否仅预览
   * @param onProgress - 进度回调
   * @returns 批量重命名结果
   */
  public async batchRenameFiles(
    filePaths: string[],
    outputDir?: string,
    preview = false,
  ): Promise<{
    results: RenameResult[];
    stats: MixedBatchStats;
  }> {
    const startTime = Date.now();
    const config = getConfigManager();

    if (config.isVerboseMode()) {
      console.log(`开始批量重命名 ${filePaths.length} 个文件`);
    }

    // 使用新的媒体批量处理器进行处理
    const batchResult = await this.mediaBatchProcessor.batchProcessMedia(
      filePaths,
      undefined,
    );

    // 将媒体批量处理结果转换为重命名结果
    const renameResults: RenameResult[] = [];

    for (const mediaResult of batchResult.results) {
      const { batchItem, analysisResult, success, error } = mediaResult;

      if (success && analysisResult) {
        const fileInfo = FileUtils.getFileInfo(batchItem.originalPath);
        if (fileInfo) {
          const targetDir = outputDir || dirname(fileInfo.path);
          const newFilePath = this.generateNewFilePath(
            targetDir,
            analysisResult.suggestedName,
            fileInfo.extension,
          );

          let renameSuccess = true;
          let renameError: string | undefined;

          if (!preview) {
            renameSuccess = FileUtils.renameFile(fileInfo.path, newFilePath);
            if (!renameSuccess) {
              renameError = "重命名失败";
            }
          }

          const renameResult: RenameResult = {
            originalPath: fileInfo.path,
            newPath: newFilePath,
            success: renameSuccess,
            analysisResult,
            error: renameError,
          };

          renameResults.push(renameResult);
          this.renameHistory.push(renameResult);
        }
      } else {
        // 处理失败的情况
        const fileInfo = FileUtils.getFileInfo(batchItem.originalPath);
        if (fileInfo) {
          const renameResult: RenameResult = {
            originalPath: fileInfo.path,
            newPath: fileInfo.path,
            success: false,
            analysisResult: {
              originalPath: fileInfo.path,
              suggestedName: fileInfo.name,
              description: "分析失败",
              tags: [],
              timestamp: Date.now(),
              filename: fileInfo.name,
            },
            error: error || "分析失败",
          };

          renameResults.push(renameResult);
        }
      }
    }

    const endTime = Date.now();
    const successfulResults = renameResults.filter((r) => r.success);
    const failedResults = renameResults.filter((r) => !r.success);

    // 使用混合批量处理统计信息
    const stats: MixedBatchStats = {
      ...batchResult.stats,
      totalFiles: filePaths.length,
      successfulFiles: successfulResults.length,
      failedFiles: failedResults.length,
      totalProcessingTime: endTime - startTime,
      batchStats: {
        ...batchResult.stats.batchStats,
        successfulBatches: successfulResults.length,
        failedBatches: failedResults.length,
      },
    };

    if (config.isVerboseMode()) {
      console.log(
        `批量重命名完成: ${successfulResults.length} 成功，${failedResults.length} 失败`,
      );
      console.log(
        `处理统计: 图片 ${stats.imageFiles} 个, 视频 ${stats.videoFiles} 个, 总帧数 ${stats.totalFrames}`,
      );
    }

    return { results: renameResults, stats };
  }

  /**
   * 分析视频文件
   * @param videoPath - 视频文件路径
   * @returns 分析结果
   */
  private async analyzeVideo(videoPath: string): Promise<AnalysisResult> {
    const config = getConfigManager();

    if (config.isVerboseMode()) {
      console.log(`提取视频帧: ${videoPath}`);
    }

    // 提取视频帧
    const frameInfo = await this.videoProcessor.extractFrames(videoPath);

    if (frameInfo.framePaths.length === 0) {
      throw new Error(`无法从视频中提取帧: ${videoPath}`);
    }

    if (config.isVerboseMode()) {
      console.log(`提取了 ${frameInfo.framePaths.length} 帧`);
    }

    // 分析提取的帧
    const analysisResult = await this.analyzer.analyzeImage(
      frameInfo.framePaths[0],
    );

    // 更新原始路径
    analysisResult.originalPath = videoPath;

    return analysisResult;
  }

  /**
   * 生成新的文件路径
   * @param targetDir - 目标目录
   * @param suggestedName - 建议的文件名
   * @param extension - 文件扩展名
   * @returns 新文件路径
   */
  private generateNewFilePath(
    targetDir: string,
    suggestedName: string,
    extension: string,
  ): string {
    const uniqueName = FileUtils.generateUniqueFilename(
      targetDir,
      suggestedName,
      extension,
    );
    return join(targetDir, `${uniqueName}.${extension}`);
  }

  /**
   * 获取重命名历史记录
   * @returns 历史记录列表
   */
  public getRenameHistory(): RenameResult[] {
    return [...this.renameHistory];
  }

  /**
   * 清空重命名历史记录
   */
  public clearRenameHistory(): void {
    this.renameHistory = [];
  }

  /**
   * 撤销上一次重命名
   * @returns 是否成功
   */
  public async undoLastRename(): Promise<boolean> {
    const lastRename = this.renameHistory[this.renameHistory.length - 1];
    if (!lastRename || !lastRename.success) {
      return false;
    }

    try {
      const success = FileUtils.renameFile(
        lastRename.newPath,
        lastRename.originalPath,
      );
      if (success) {
        this.renameHistory.pop();
      }
      return success;
    } catch (error) {
      console.error("撤销重命名失败:", error);
      return false;
    }
  }

  /**
   * 预览重命名结果
   * @param filePaths - 文件路径列表
   * @returns 预览结果
   */
  public async previewRename(filePaths: string[]): Promise<
    Array<{
      originalName: string;
      newName: string;
    }>
  > {
    const results = await this.batchRenameFiles(filePaths, undefined, true);

    return results.results.map((result) => ({
      originalName: FileUtils.getFileNameWithoutExtension(result.originalPath),
      newName: FileUtils.getFileNameWithoutExtension(result.newPath),
    }));
  }

  /**
   * 获取重命名统计信息
   * @returns 统计信息
   */
  public getStats(): {
    totalRenamed: number;
    successfulRenamed: number;
    failedRenamed: number;
  } {
    const successful = this.renameHistory.filter((r) => r.success);
    const failed = this.renameHistory.filter((r) => !r.success);

    return {
      totalRenamed: this.renameHistory.length,
      successfulRenamed: successful.length,
      failedRenamed: failed.length,
    };
  }

  /**
   * 销毁重命名器
   */
  public destroy(): void {
    this.analyzer.destroy();
    this.batchProcessor.destroy();
    this.videoProcessor.destroy();
    this.mediaBatchProcessor.destroy();
  }
}

/**
 * 重命名策略接口
 */
export interface RenameStrategy {
  /**
   * 应用重命名策略
   * @param analysisResult - 分析结果
   * @param originalPath - 原始文件路径
   * @returns 新文件名
   */
  apply(analysisResult: AnalysisResult, originalPath: string): string;
}

/**
 * 默认重命名策略
 */
export class DefaultRenameStrategy implements RenameStrategy {
  apply(analysisResult: AnalysisResult, _originalPath: string): string {
    return analysisResult.suggestedName;
  }
}

/**
 * 时间戳重命名策略
 */
export class TimestampRenameStrategy implements RenameStrategy {
  apply(analysisResult: AnalysisResult): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${timestamp}_${analysisResult.suggestedName}`;
  }
}
