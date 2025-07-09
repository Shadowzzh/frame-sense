/**
 * 智能重命名器
 * 提供语义化文件重命名功能，包括冲突处理和批量操作
 */

import { dirname, join } from "node:path";
import { AIAnalyzer, AIBatchProcessor } from "@/core/ai-analyzer";
import { getConfigManager } from "@/core/config";
import { VideoProcessor } from "@/core/video-processor";
import type {
  AnalysisResult,
  BatchProcessingStats,
  MediaFileInfo,
  RenameResult,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { UIUtils } from "@/utils/ui-utils";

export class SmartRenamer {
  /** AI 分析器 */
  private analyzer: AIAnalyzer;
  /** 批量处理器 */
  private batchProcessor: AIBatchProcessor;
  /** 视频处理器 */
  private videoProcessor: VideoProcessor;
  /** 重命名历史记录 */
  private renameHistory: RenameResult[] = [];

  constructor() {
    this.analyzer = new AIAnalyzer();
    this.batchProcessor = new AIBatchProcessor();
    this.videoProcessor = new VideoProcessor();
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

    if (config.isDebugMode()) {
      console.log(`开始分析文件: ${filePath}`);
    }

    const spinner = UIUtils.createSpinner("AI 正在分析文件...\n");
    spinner.start();

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

      if (config.isDebugMode()) {
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
    } finally {
      spinner.stop();
    }
  }

  /**
   * 批量重命名文件
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
    onProgress?: (current: number, total: number, currentFile: string) => void,
  ): Promise<{
    results: RenameResult[];
    stats: BatchProcessingStats;
  }> {
    const startTime = Date.now();
    const config = getConfigManager();

    if (config.isDebugMode()) {
      console.log(`开始批量重命名 ${filePaths.length} 个文件`);
    }

    // 按文件类型分组
    const imageFiles: string[] = [];
    const videoFiles: string[] = [];
    const validFiles: MediaFileInfo[] = [];

    for (const filePath of filePaths) {
      const fileInfo = FileUtils.getFileInfo(filePath);
      if (fileInfo) {
        validFiles.push(fileInfo);
        if (fileInfo.type === "image") {
          imageFiles.push(filePath);
        } else if (fileInfo.type === "video") {
          videoFiles.push(filePath);
        }
      }
    }

    if (config.isVerboseMode()) {
      console.log(
        `找到 ${imageFiles.length} 个图像文件，${videoFiles.length} 个视频文件`,
      );
    }

    const allResults: RenameResult[] = [];
    let processedCount = 0;

    // 批量处理图像文件
    if (imageFiles.length > 0) {
      const { results: analysisResults } =
        await this.batchProcessor.smartBatchProcess(
          imageFiles,
          undefined,
          (current, _total, currentBatch, totalBatches) => {
            if (onProgress) {
              onProgress(
                processedCount + current,
                filePaths.length,
                `批次 ${currentBatch}/${totalBatches}`,
              );
            }
          },
        );

      // 生成重命名结果
      for (const analysisResult of analysisResults) {
        const fileInfo = validFiles.find(
          (f) => f.path === analysisResult.originalPath,
        );
        if (fileInfo) {
          const targetDir = outputDir || dirname(fileInfo.path);
          const newFilePath = this.generateNewFilePath(
            targetDir,
            analysisResult.suggestedName,
            fileInfo.extension,
          );

          let success = true;
          let error: string | undefined;

          if (!preview) {
            success = FileUtils.renameFile(fileInfo.path, newFilePath);
            if (!success) {
              error = "重命名失败";
            }
          }

          const result: RenameResult = {
            originalPath: fileInfo.path,
            newPath: newFilePath,
            success,
            analysisResult,
            error,
          };

          allResults.push(result);
          this.renameHistory.push(result);
        }
      }

      processedCount += imageFiles.length;
    }

    // 处理视频文件
    for (const videoFile of videoFiles) {
      if (onProgress) {
        onProgress(processedCount + 1, filePaths.length, videoFile);
      }

      try {
        const result = await this.renameSingleFile(
          videoFile,
          outputDir,
          preview,
        );
        allResults.push(result);
      } catch (error) {
        console.error(`处理视频文件失败 ${videoFile}:`, error);
      }

      processedCount++;
    }

    const endTime = Date.now();
    const successfulResults = allResults.filter((r) => r.success);
    const failedResults = allResults.filter((r) => !r.success);

    const stats: BatchProcessingStats = {
      totalFiles: filePaths.length,
      successfulFiles: successfulResults.length,
      failedFiles: failedResults.length,
      totalProcessingTime: endTime - startTime,
      batchStats: {
        totalBatches:
          Math.ceil(
            imageFiles.length / config.getBatchProcessingConfig().batchSize,
          ) + videoFiles.length,
        successfulBatches: successfulResults.length,
        failedBatches: failedResults.length,
      },
    };

    if (config.isDebugMode()) {
      console.log(
        `批量重命名完成: ${successfulResults.length} 成功，${failedResults.length} 失败`,
      );
    }

    return { results: allResults, stats };
  }

  /**
   * 重命名目录中的所有媒体文件
   * @param dirPath - 目录路径
   * @param outputDir - 输出目录（可选）
   * @param preview - 是否仅预览
   * @param onProgress - 进度回调
   * @returns 重命名结果
   */
  // public async renameDirectory(
  //   dirPath: string,
  //   outputDir?: string,
  //   preview = false,
  //   onProgress?: (current: number, total: number, currentFile: string) => void,
  // ): Promise<{
  //   results: RenameResult[];
  //   stats: BatchProcessingStats;
  // }> {
  //   const config = getConfigManager();

  //   if (!FileUtils.fileExists(dirPath)) {
  //     throw new Error(`目录不存在: ${dirPath}`);
  //   }

  //   if (config.isDebugMode()) {
  //     console.log(`开始处理目录: ${dirPath}`);
  //   }

  //   // 获取目录中的所有媒体文件
  //   const mediaFiles = FileUtils.getMediaFiles(dirPath, false); // 不递归
  //   const filePaths = mediaFiles.map((file) => file.path);

  //   if (filePaths.length === 0) {
  //     throw new Error(`目录中没有找到媒体文件: ${dirPath}`);
  //   }

  //   if (config.isVerboseMode()) {
  //     console.log(`找到 ${filePaths.length} 个媒体文件`);
  //   }

  //   return this.batchRenameFiles(filePaths, outputDir, preview, onProgress);
  // }

  /**
   * 分析视频文件
   * @param videoPath - 视频文件路径
   * @returns 分析结果
   */
  private async analyzeVideo(videoPath: string): Promise<AnalysisResult> {
    const config = getConfigManager();

    if (config.isDebugMode()) {
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
