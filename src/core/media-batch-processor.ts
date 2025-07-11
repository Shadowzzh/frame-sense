/**
 * 媒体批量处理器
 * 统一处理图片和视频的批量分析，支持混合批次处理
 */

import { basename, dirname, join } from "node:path";
import { AIBatchProcessor } from "@/core/ai-analyzer";
import { getConfigManager } from "@/core/config";
import { ImageProcessor } from "@/core/image-processor";
import { VideoProcessor } from "@/core/video-processor";
import type {
  AnalysisResult,
  MediaBatchItem,
  MediaBatchResult,
  MixedBatchStats,
  RenameResult,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { progressLogger } from "@/utils/progress-logger";
import { TemplateResolver } from "@/utils/template-resolver";

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

    progressLogger.succeedProgress(
      `帧提取完成，耗时 ${frameExtractionTime / 1000} 秒`,
    );
    progressLogger.debug(`总共准备 ${mediaBatchItems.length} 个处理项`);

    // 第二步：创建混合批次
    const mixedBatches = this.createMixedBatches(mediaBatchItems);
    progressLogger.debug(`创建 ${mixedBatches.length} 个混合批次进行AI分析`);

    // 第三步：增量处理 - AI分析 → 立即处理结果
    const results = await this.incrementalProcessBatches(
      mixedBatches,
      userPrompt,
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
   * 批量处理并重命名媒体文件（新增量处理版本）
   * @param filePaths - 文件路径列表
   * @param userPrompt - 用户提示词
   * @param outputDir - 输出目录
   * @param preview - 是否预览模式
   * @returns 批量处理结果
   */
  public async batchProcessAndRename(
    filePaths: string[],
    userPrompt?: string,
    outputDir?: string,
    preview = false,
  ): Promise<{
    results: MediaBatchResult[];
    stats: MixedBatchStats;
  }> {
    const startTime = Date.now();

    progressLogger.info(
      `📁 开始批量处理并重命名 ${filePaths.length} 个媒体文件${outputDir ? ` (输出到: ${outputDir})` : ""}`,
    );

    // 第一步：预处理文件，提取帧
    const frameExtractionStart = Date.now();
    progressLogger.startProgress("预处理文件，提取帧...");

    const mediaBatchItems = await this.preprocessFiles(filePaths);
    const frameExtractionTime = Date.now() - frameExtractionStart;

    progressLogger.succeedProgress(
      `帧提取完成，耗时 ${frameExtractionTime / 1000} 秒`,
    );
    progressLogger.debug(`总共准备 ${mediaBatchItems.length} 个处理项`);

    // 第二步：创建混合批次
    const mixedBatches = this.createMixedBatches(mediaBatchItems);
    progressLogger.debug(`创建 ${mixedBatches.length} 个混合批次进行增量处理`);

    // 第三步：增量处理 - AI分析 → 立即重命名
    const results = await this.incrementalProcessBatches(
      mixedBatches,
      userPrompt,
      outputDir,
      preview,
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
   * 增量处理批次：AI分析一批立即处理结果
   * @param mixedBatches - 混合批次列表
   * @param userPrompt - 用户提示词
   * @param outputDir - 输出目录
   * @param preview - 是否预览模式
   * @returns 处理结果列表
   */
  private async incrementalProcessBatches(
    mixedBatches: {
      framePaths: string[];
      itemMappings: Array<{
        frameIndex: number;
        batchItem: MediaBatchItem;
        framePathIndex: number;
      }>;
    }[],
    userPrompt?: string,
    outputDir?: string,
    preview = false,
  ): Promise<MediaBatchResult[]> {
    const allResults: MediaBatchResult[] = [];
    const completedFiles = new Set<string>();

    const totalFrames = mixedBatches.reduce(
      (sum, batch) => sum + batch.framePaths.length,
      0,
    );

    progressLogger.info(
      `开始处理：${mixedBatches.length} 个批次，共 ${totalFrames} 帧`,
    );

    progressLogger.startProgress("增量处理批次...");

    for (let i = 0; i < mixedBatches.length; i++) {
      const batch = mixedBatches[i];

      // 更新进度显示当前进度
      progressLogger.updateProgress(
        `批次 ${i + 1}/${mixedBatches.length}: AI分析 ${batch.framePaths.length} 张图片...`,
      );

      try {
        // 步骤1：AI分析当前批次
        const batchResult = await this.aiBatchProcessor.smartBatchProcess(
          batch.framePaths,
          userPrompt,
        );

        // 步骤2：立即处理当前批次的结果
        const batchResults = await this.processBatchResults(
          batch,
          batchResult.results,
          outputDir,
          preview,
          completedFiles,
        );

        allResults.push(...batchResults);

        progressLogger.updateProgress(
          `批次 ${i + 1}/${mixedBatches.length}: 完成重命名 ${batchResults.length} 个文件`,
        );
        progressLogger.debug(
          `批次 ${i + 1}/${mixedBatches.length} 完成，处理了 ${batch.framePaths.length} 帧，完成 ${batchResults.length} 个文件`,
        );
      } catch (error) {
        progressLogger.error(`批次 ${i + 1} 处理失败: ${error}`);

        // 处理失败的批次，创建失败结果
        const failedResults = this.createFailedResults(batch, error);
        allResults.push(...failedResults);
      }
    }

    progressLogger.succeedProgress("增量处理完成");
    return allResults;
  }

  /**
   * 处理单个批次的结果：分析完成后立即重命名
   * @param batch - 批次数据
   * @param analysisResults - AI分析结果
   * @param outputDir - 输出目录
   * @param preview - 是否预览模式
   * @param completedFiles - 已完成的文件集合
   * @returns 处理结果
   */
  private async processBatchResults(
    batch: {
      framePaths: string[];
      itemMappings: Array<{
        frameIndex: number;
        batchItem: MediaBatchItem;
        framePathIndex: number;
      }>;
    },
    analysisResults: AnalysisResult[],
    outputDir?: string,
    preview = false,
    completedFiles?: Set<string>,
  ): Promise<MediaBatchResult[]> {
    const results: MediaBatchResult[] = [];
    const fileResultsMap = new Map<string, AnalysisResult[]>();

    // 将分析结果映射到原始文件
    for (let j = 0; j < analysisResults.length; j++) {
      const result = analysisResults[j];
      const mapping = batch.itemMappings[j];

      if (mapping) {
        const originalPath = mapping.batchItem.originalPath;

        // 跳过已完成的文件
        if (completedFiles?.has(originalPath)) {
          continue;
        }

        if (!fileResultsMap.has(originalPath)) {
          fileResultsMap.set(originalPath, []);
        }

        // 更新结果的原始路径
        const updatedResult = {
          ...result,
          originalPath,
        };

        fileResultsMap.get(originalPath)?.push(updatedResult);
      }
    }

    // 为每个文件执行重命名
    for (const [originalPath, frameResults] of fileResultsMap) {
      if (frameResults.length > 0) {
        const batchItem = batch.itemMappings.find(
          (m) => m.batchItem.originalPath === originalPath,
        )?.batchItem;

        if (batchItem) {
          // 使用第一个帧的分析结果作为文件的分析结果
          const primaryResult = frameResults[0];

          try {
            // 执行重命名
            const renameResult = await this.renameFile(
              batchItem,
              primaryResult,
              outputDir,
              preview,
            );

            results.push({
              batchItem,
              analysisResult: primaryResult,
              success: renameResult.success,
              error: renameResult.error,
              newPath: renameResult.newPath,
            });

            // 标记为已完成
            completedFiles?.add(originalPath);

            if (renameResult.success) {
              progressLogger.info(
                `✓ ${preview ? "预览" : "重命名"}: ${basename(originalPath)} → ${basename(renameResult.newPath)}`,
              );
            } else {
              progressLogger.warn(
                `✗ ${preview ? "预览" : "重命名"}失败: ${basename(originalPath)} - ${renameResult.error}`,
              );
            }
          } catch (error) {
            results.push({
              batchItem,
              analysisResult: primaryResult,
              success: false,
              error: error instanceof Error ? error.message : "重命名失败",
              newPath: batchItem.originalPath, // 失败时新路径等于原路径
            });

            progressLogger.error(
              `重命名失败: ${basename(originalPath)} - ${error}`,
            );
          }
        }
      }
    }

    return results;
  }

  /**
   * 重命名单个文件
   * @param batchItem - 批次项
   * @param analysisResult - 分析结果
   * @param outputDir - 输出目录
   * @param preview - 是否预览模式
   * @returns 重命名结果
   */
  private async renameFile(
    batchItem: MediaBatchItem,
    analysisResult: AnalysisResult,
    outputDir?: string,
    preview = false,
  ): Promise<RenameResult> {
    const fileInfo = FileUtils.getFileInfo(batchItem.originalPath);
    if (!fileInfo) {
      throw new Error(`无法获取文件信息: ${batchItem.originalPath}`);
    }

    // 生成新的文件路径
    const targetDir = outputDir || dirname(batchItem.originalPath);
    const newFilePath = await this.generateNewFilePath(
      targetDir,
      analysisResult.suggestedName,
      fileInfo.extension,
      batchItem.originalPath,
    );

    // 如果是预览模式，不执行实际重命名
    if (preview) {
      return {
        originalPath: batchItem.originalPath,
        newPath: newFilePath,
        success: true,
        analysisResult,
      };
    }

    // 执行重命名
    let success: boolean;
    if (outputDir && outputDir !== dirname(batchItem.originalPath)) {
      // 如果指定了输出目录且与原文件目录不同，则复制文件
      success = FileUtils.copyFile(batchItem.originalPath, newFilePath);
    } else {
      // 否则移动文件
      success = FileUtils.renameFile(batchItem.originalPath, newFilePath);
    }

    return {
      originalPath: batchItem.originalPath,
      newPath: newFilePath,
      success,
      analysisResult,
      error: success ? undefined : "重命名失败",
    };
  }

  /**
   * 生成新的文件路径
   * @param targetDir - 目标目录
   * @param suggestedName - 建议的文件名
   * @param extension - 文件扩展名
   * @param originalFilePath - 原始文件路径
   * @returns 新文件路径
   */
  private async generateNewFilePath(
    targetDir: string,
    suggestedName: string,
    extension: string,
    originalFilePath: string,
  ): Promise<string> {
    const config = getConfigManager();
    let finalName = suggestedName;

    // 如果配置了文件名模板，使用模板解析
    if (config.isFilenameTemplateEnabled()) {
      const templateConfig = config.getFilenameTemplateConfig();
      if (templateConfig.template) {
        finalName = await TemplateResolver.resolveTemplate(
          templateConfig.template,
          suggestedName,
          originalFilePath,
          templateConfig,
        );
      }
    }

    const uniqueName = FileUtils.generateUniqueFilename(
      targetDir,
      finalName,
      extension,
    );
    return join(targetDir, `${uniqueName}.${extension}`);
  }

  /**
   * 创建失败结果
   * @param batch - 批次数据
   * @param error - 错误信息
   * @returns 失败结果列表
   */
  private createFailedResults(
    batch: {
      framePaths: string[];
      itemMappings: Array<{
        frameIndex: number;
        batchItem: MediaBatchItem;
        framePathIndex: number;
      }>;
    },
    error: unknown,
  ): MediaBatchResult[] {
    const results: MediaBatchResult[] = [];
    const processedFiles = new Set<string>();

    for (const mapping of batch.itemMappings) {
      const originalPath = mapping.batchItem.originalPath;

      // 避免重复处理同一文件
      if (processedFiles.has(originalPath)) {
        continue;
      }

      processedFiles.add(originalPath);

      results.push({
        batchItem: mapping.batchItem,
        success: false,
        error: error instanceof Error ? error.message : "处理失败",
        newPath: mapping.batchItem.originalPath, // 失败时新路径等于原路径
      });
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
