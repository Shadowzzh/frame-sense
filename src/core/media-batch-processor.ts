/**
 * 媒体批量处理器
 * 统一处理图片和视频的批量分析，支持混合批次处理
 */

import { AIBatchProcessor } from "@/core/ai-analyzer";
import { getConfigManager } from "@/core/config";
import { ImageProcessor } from "@/core/image-processor";
import { VideoProcessor } from "@/core/video-processor";
import type {
  AnalysisResult,
  MediaBatchItem,
  MediaBatchResult,
  MixedBatchStats,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { progressLogger } from "@/utils/progress-logger";

export class MediaBatchProcessor {
  /** AI 批量处理器 */
  private aiBatchProcessor: AIBatchProcessor;
  /** 视频处理器 */
  private videoProcessor: VideoProcessor;
  /** 图像处理器 */
  private imageProcessor: ImageProcessor;
  /** 临时文件清理列表 */
  private tempFiles: string[] = [];

  constructor() {
    this.aiBatchProcessor = new AIBatchProcessor();
    this.videoProcessor = new VideoProcessor();
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * 批量处理媒体文件
   * @param filePaths - 文件路径列表
   * @param userPrompt - 用户提示词
   * @returns 批量处理结果
   */
  public async batchProcessMedia(
    filePaths: string[],
    userPrompt?: string,
  ): Promise<{
    results: MediaBatchResult[];
    stats: MixedBatchStats;
  }> {
    const startTime = Date.now();

    progressLogger.info(`开始批量处理 ${filePaths.length} 个媒体文件`);

    // 第一步：预处理文件，提取帧
    const frameExtractionStart = Date.now();
    progressLogger.startProgress("预处理文件，提取帧...");

    const mediaBatchItems = await this.preprocessFiles(filePaths);
    const frameExtractionTime = Date.now() - frameExtractionStart;

    progressLogger.succeedProgress(`帧提取完成，耗时 ${frameExtractionTime}ms`);
    progressLogger.debug(`总共准备 ${mediaBatchItems.length} 个处理项`);

    // 第二步：创建混合批次
    const mixedBatches = this.createMixedBatches(mediaBatchItems);
    progressLogger.debug(`创建 ${mixedBatches.length} 个混合批次进行AI分析`);

    // 第三步：批量AI分析
    const analysisResults = await this.batchAnalyzeFrames(
      mixedBatches,
      userPrompt,
    );

    // 第四步：映射结果
    const results = this.mapResultsToOriginalFiles(
      mediaBatchItems,
      analysisResults,
    );

    const endTime = Date.now();

    // 统计信息
    const stats = this.calculateStats(
      results,
      filePaths,
      frameExtractionTime,
      endTime - startTime,
    );

    progressLogger.info(
      `批量处理完成: ${stats.successfulFiles}/${stats.totalFiles} 成功`,
    );

    return { results, stats };
  }

  /**
   * 预处理文件：验证文件并提取视频帧
   * @param filePaths - 文件路径列表
   * @returns 媒体批次项列表
   */
  private async preprocessFiles(
    filePaths: string[],
  ): Promise<MediaBatchItem[]> {
    const mediaBatchItems: MediaBatchItem[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      // 更新进度显示当前进度
      progressLogger.updateProgress(
        `预处理文件 (${i + 1}/${filePaths.length}): ${filePath}`,
      );

      try {
        const fileInfo = FileUtils.getFileInfo(filePath);
        if (!fileInfo) {
          progressLogger.warn(`跳过无效文件: ${filePath}`);
          continue;
        }

        if (fileInfo.type === "image") {
          // 图片文件直接添加
          mediaBatchItems.push({
            originalPath: filePath,
            framePaths: [filePath],
            mediaType: "image",
            metadata: {
              extension: fileInfo.extension,
            },
          });
        } else if (fileInfo.type === "video") {
          // 视频文件提取帧
          const frameInfo = await this.videoProcessor.extractFrames(filePath);

          if (frameInfo.framePaths.length > 0) {
            // 记录临时文件以便后续清理
            this.tempFiles.push(...frameInfo.framePaths);

            mediaBatchItems.push({
              originalPath: filePath,
              framePaths: frameInfo.framePaths,
              mediaType: "video",
              metadata: {
                videoInfo: frameInfo,
                extension: fileInfo.extension,
              },
            });
          } else {
            progressLogger.warn(`无法从视频中提取帧: ${filePath}`);
          }
        }
      } catch (error) {
        progressLogger.error(`预处理文件失败 ${filePath}: ${error}`);
      }
    }

    return mediaBatchItems;
  }

  /**
   * 创建混合批次：将所有帧（无论来源）分组为批次
   * @param mediaBatchItems - 媒体批次项列表
   * @returns 混合批次列表
   */
  private createMixedBatches(mediaBatchItems: MediaBatchItem[]): {
    framePaths: string[];
    itemMappings: Array<{
      frameIndex: number;
      batchItem: MediaBatchItem;
      framePathIndex: number;
    }>;
  }[] {
    const config = getConfigManager();
    const batchSize = config.getBatchProcessingConfig().batchSize;

    // 收集所有帧路径及其对应的原始文件信息
    const allFrames: Array<{
      framePath: string;
      batchItem: MediaBatchItem;
      framePathIndex: number;
    }> = [];

    for (const batchItem of mediaBatchItems) {
      for (let i = 0; i < batchItem.framePaths.length; i++) {
        allFrames.push({
          framePath: batchItem.framePaths[i],
          batchItem,
          framePathIndex: i,
        });
      }
    }

    // 按批次大小分组
    const mixedBatches: {
      framePaths: string[];
      itemMappings: Array<{
        frameIndex: number;
        batchItem: MediaBatchItem;
        framePathIndex: number;
      }>;
    }[] = [];

    for (let i = 0; i < allFrames.length; i += batchSize) {
      const batchFrames = allFrames.slice(i, i + batchSize);

      mixedBatches.push({
        framePaths: batchFrames.map((f) => f.framePath),
        itemMappings: batchFrames.map((f, index) => ({
          frameIndex: index,
          batchItem: f.batchItem,
          framePathIndex: f.framePathIndex,
        })),
      });
    }

    return mixedBatches;
  }

  /**
   * 批量分析帧
   * @param mixedBatches - 混合批次列表
   * @param userPrompt - 用户提示词
   * @returns 分析结果映射
   */
  private async batchAnalyzeFrames(
    mixedBatches: {
      framePaths: string[];
      itemMappings: Array<{
        frameIndex: number;
        batchItem: MediaBatchItem;
        framePathIndex: number;
      }>;
    }[],
    userPrompt?: string,
  ): Promise<Map<string, AnalysisResult[]>> {
    const analysisResults = new Map<string, AnalysisResult[]>();

    const totalFrames = mixedBatches.reduce(
      (sum, batch) => sum + batch.framePaths.length,
      0,
    );

    progressLogger.debug(
      `开始分析 ${mixedBatches.length} 个混合批次，共 ${totalFrames} 帧`,
    );

    progressLogger.startProgress("AI分析批次...");

    for (let i = 0; i < mixedBatches.length; i++) {
      const batch = mixedBatches[i];

      // 更新进度显示当前进度
      progressLogger.updateProgress(
        `AI分析批次 (${i + 1}/${mixedBatches.length}): ${batch.framePaths.length} 帧`,
      );

      try {
        // 使用现有的 AI 批量处理器
        const batchResult = await this.aiBatchProcessor.smartBatchProcess(
          batch.framePaths,
          userPrompt,
        );

        // 将结果映射到原始文件
        for (let j = 0; j < batchResult.results.length; j++) {
          const result = batchResult.results[j];
          const mapping = batch.itemMappings[j];

          if (mapping) {
            const originalPath = mapping.batchItem.originalPath;

            if (!analysisResults.has(originalPath)) {
              analysisResults.set(originalPath, []);
            }

            // 更新结果的原始路径
            const updatedResult = {
              ...result,
              originalPath,
            };

            analysisResults.get(originalPath)?.push(updatedResult);
          }
        }

        progressLogger.debug(
          `批次 ${i + 1}/${mixedBatches.length} 完成，处理了 ${batch.framePaths.length} 帧`,
        );
      } catch (error) {
        progressLogger.error(`批次 ${i + 1} 分析失败: ${error}`);
      }
    }

    progressLogger.succeedProgress("AI分析完成");
    return analysisResults;
  }

  /**
   * 将分析结果映射到原始文件
   * @param mediaBatchItems - 媒体批次项列表
   * @param analysisResults - 分析结果映射
   * @returns 媒体批量处理结果
   */
  private mapResultsToOriginalFiles(
    mediaBatchItems: MediaBatchItem[],
    analysisResults: Map<string, AnalysisResult[]>,
  ): MediaBatchResult[] {
    const results: MediaBatchResult[] = [];

    for (const batchItem of mediaBatchItems) {
      const originalPath = batchItem.originalPath;
      const frameResults = analysisResults.get(originalPath) || [];

      if (frameResults.length > 0) {
        // 对于视频，选择第一个帧的分析结果作为视频的分析结果
        // 对于图片，直接使用唯一的分析结果
        const primaryResult = frameResults[0];

        results.push({
          batchItem,
          analysisResult: primaryResult,
          success: true,
        });
      } else {
        results.push({
          batchItem,
          success: false,
          error: "未获得分析结果",
        });
      }
    }

    return results;
  }

  /**
   * 计算统计信息
   * @param results - 处理结果
   * @param originalFilePaths - 原始文件路径
   * @param frameExtractionTime - 帧提取时间
   * @param totalTime - 总处理时间
   * @returns 统计信息
   */
  private calculateStats(
    results: MediaBatchResult[],
    originalFilePaths: string[],
    frameExtractionTime: number,
    totalTime: number,
  ): MixedBatchStats {
    const successfulResults = results.filter((r) => r.success);
    const config = getConfigManager();

    let imageFiles = 0;
    let videoFiles = 0;
    let totalFrames = 0;

    for (const result of results) {
      if (result.batchItem.mediaType === "image") {
        imageFiles++;
        totalFrames += result.batchItem.framePaths.length;
      } else if (result.batchItem.mediaType === "video") {
        videoFiles++;
        totalFrames += result.batchItem.framePaths.length;
      }
    }

    const batchSize = config.getBatchProcessingConfig().batchSize;
    const totalBatches = Math.ceil(totalFrames / batchSize);

    return {
      totalFiles: originalFilePaths.length,
      successfulFiles: successfulResults.length,
      failedFiles: results.length - successfulResults.length,
      totalProcessingTime: totalTime,
      imageFiles,
      videoFiles,
      totalFrames,
      frameExtractionTime,
      batchStats: {
        totalBatches,
        successfulBatches: successfulResults.length,
        failedBatches: results.length - successfulResults.length,
      },
    };
  }

  /**
   * 清理临时文件
   */
  public cleanup(): void {
    // 清理提取的视频帧
    this.videoProcessor.cleanup();

    // 清理处理过的图像
    this.imageProcessor.cleanup();

    // 清理记录的临时文件
    for (const tempFile of this.tempFiles) {
      try {
        if (FileUtils.fileExists(tempFile)) {
          require("node:fs").unlinkSync(tempFile);
        }
      } catch (error) {
        progressLogger.debug(`清理临时文件失败 ${tempFile}: ${error}`);
      }
    }

    this.tempFiles = [];
  }

  /**
   * 销毁处理器
   */
  public destroy(): void {
    this.cleanup();
    this.aiBatchProcessor.destroy();
    this.videoProcessor.destroy();
    this.imageProcessor.destroy();
  }
}
