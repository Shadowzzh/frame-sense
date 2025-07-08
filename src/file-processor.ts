/**
 * 文件处理器 - 统一处理入口
 */

import { basename } from "node:path";
import ora from "ora";
import type { CategorizedFiles, ProcessContext, ProcessResult } from "@/types";
import { logger } from "@/utils/logger";

/**
 * 处理所有文件
 */
export async function processAllFiles(
  files: CategorizedFiles,
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { imageFiles, videoFiles } = files;
  const results: ProcessResult[] = [];

  // 如果没有任何文件，则返回空结果
  if (imageFiles.length === 0 && videoFiles.length === 0) {
    return results;
  }

  // 统一显示开始处理信息
  const totalFiles = imageFiles.length + videoFiles.length;
  logger.progress(`📋 开始处理 ${totalFiles} 个文件`);

  if (imageFiles.length > 0) {
    logger.debug(`  - 图片: ${imageFiles.length} 张`);
  }
  if (videoFiles.length > 0) {
    logger.debug(`  - 视频: ${videoFiles.length} 个`);
  }

  // 处理图片文件
  if (imageFiles.length > 0) {
    logger.verbose("🖼️  开始处理图片文件...");
    const imageResults = await processImages(imageFiles, context);
    results.push(...imageResults);
    logger.verbose(`✅ 图片处理完成，共处理 ${imageResults.length} 张`);
  }

  // 处理视频文件
  if (videoFiles.length > 0) {
    logger.verbose("🎬 开始处理视频文件...");
    const videoResults = await processVideos(videoFiles, context);
    results.push(...videoResults);
    logger.verbose(`✅ 视频处理完成，共处理 ${videoResults.length} 个`);
  }

  return results;
}

/**
 * 处理图片文件
 */
export async function processImages(
  imageFiles: string[],
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { aiAnalyzer, fileRenamer, options } = context;
  const results: ProcessResult[] = [];

  if (imageFiles.length === 0) {
    return results;
  }

  logger.progress(`📸 开始处理 ${imageFiles.length} 张图片`);

  try {
    // AI 分析
    const analysis = await aiAnalyzer.analyzeImage(imageFiles);
    // 如果分析结果包含 "|||",则将分析结果按 "|||" 分割
    const descriptions = analysis.includes("|||")
      ? analysis.split("|||")
      : imageFiles.map(() => analysis);

    // 逐个重命名图片
    const renameSpinner = ora(
      `📝 重命名图片 (0/${imageFiles.length})...`,
    ).start();

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileAnalysis = descriptions[i] || analysis;

      renameSpinner.text = `📝 重命名图片 (${i + 1}/${imageFiles.length})... ${basename(file)}`;

      try {
        const newName = fileRenamer.generateNewName(
          file,
          fileAnalysis,
          options.format as "semantic" | "structured",
        );

        if (!options.dryRun) {
          await fileRenamer.renameFile(file, newName);
        }

        results.push({
          originalPath: file,
          newName,
          analysis: fileAnalysis,
          success: true,
        });
      } catch (error) {
        results.push({
          originalPath: file,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }

    renameSpinner.succeed(`✅ 完成 ${imageFiles.length} 张图片重命名`);
  } catch (error) {
    logger.error(
      `❌ 图片处理失败: ${error instanceof Error ? error.message : error}`,
    );

    for (const file of imageFiles) {
      results.push({
        originalPath: file,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }

  return results;
}

/**
 * 处理视频文件
 */
export async function processVideos(
  videoFiles: string[],
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { frameExtractor, aiAnalyzer, fileRenamer, options } = context;
  const results: ProcessResult[] = [];

  if (videoFiles.length === 0) {
    return results;
  }

  logger.progress(`🎬 开始处理 ${videoFiles.length} 个视频`);

  const videoFramesMap = new Map<string, string[]>();

  // 提取关键帧
  const extractSpinner = ora(
    `🎞️ 提取关键帧 (0/${videoFiles.length})...`,
  ).start();

  for (let i = 0; i < videoFiles.length; i++) {
    const videoFile = videoFiles[i];

    extractSpinner.text = `🎞️ 提取关键帧 (${i + 1}/${videoFiles.length})... ${basename(videoFile)}`;

    try {
      const frames = await frameExtractor?.extractFrames(
        videoFile,
        options.frames,
      );

      if (!frames) {
        continue;
      }

      videoFramesMap.set(videoFile, frames);
    } catch (error) {
      results.push({
        originalPath: videoFile,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  }

  extractSpinner.succeed(`✅ 完成 ${videoFramesMap.size} 个视频关键帧提取`);

  // AI 批量分析并重命名视频文件
  if (videoFramesMap.size > 0) {
    try {
      // 收集所有帧文件路径进行批量分析
      const allFrames: string[] = [];
      const videoFramesCounts: number[] = [];

      for (const [, frames] of videoFramesMap) {
        allFrames.push(...frames);
        videoFramesCounts.push(frames.length);
      }

      // 单次 AI API 调用，批量分析所有视频帧
      const batchAnalysis = await aiAnalyzer.analyzeImage(allFrames);

      // 解析批量分析结果
      const analysisResults = batchAnalysis.split("|||");

      logger.progress(`🤖 处理分析结果与重命名...`);

      // 按视频分组处理分析结果
      let resultIndex = 0;
      for (const [videoFile, frames] of videoFramesMap) {
        try {
          const frameCount = frames.length;
          const videoAnalysis = analysisResults
            .slice(resultIndex, resultIndex + frameCount)
            .join(" ");

          resultIndex += frameCount;

          const newName = fileRenamer.generateNewName(
            videoFile,
            videoAnalysis || "视频内容",
            options.format as "semantic" | "structured",
          );

          if (!options.dryRun) {
            await fileRenamer.renameFile(videoFile, newName);
          }

          results.push({
            originalPath: videoFile,
            newName,
            analysis: videoAnalysis || "视频内容",
            success: true,
          });
        } catch (error) {
          results.push({
            originalPath: videoFile,
            error: error instanceof Error ? error.message : String(error),
            success: false,
          });
        }
      }

      logger.progress(
        `✅ 完成 ${videoFramesMap.size} 个视频AI批量分析与重命名`,
      );
    } catch (error) {
      logger.error("❌ AI 批量分析失败");

      // 如果批量分析失败，为每个视频添加错误结果
      for (const [videoFile] of videoFramesMap) {
        results.push({
          originalPath: videoFile,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }

    // 清理临时文件
    await cleanupFrames(videoFramesMap, frameExtractor);
  }

  return results;
}

/**
 * 清理临时文件
 */
async function cleanupFrames(
  videoFramesMap: Map<string, string[]>,
  frameExtractor?: import("@/frame-extractor").FrameExtractor,
): Promise<void> {
  const cleanupSpinner = ora(`🧹 清理临时文件...`).start();

  for (const frames of videoFramesMap.values()) {
    try {
      await frameExtractor?.cleanupFrames(frames);
    } catch {
      // 忽略清理错误
    }
  }

  cleanupSpinner.succeed(`✅ 临时文件清理完成`);
}
