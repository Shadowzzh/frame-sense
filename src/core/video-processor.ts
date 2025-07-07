/**
 * 视频处理器
 */

import { basename } from "node:path";
import chalk from "chalk";
import ora from "ora";
import type { ProcessContext, ProcessResult } from "@/types";

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

  console.log(chalk.blue(`\n🎬 开始处理 ${videoFiles.length} 个视频`));

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

  // AI 分析并重命名每个视频文件
  if (videoFramesMap.size > 0) {
    const analysisSpinner = ora(
      `🤖 AI 分析视频内容 (0/${videoFramesMap.size})...`,
    ).start();

    let processedCount = 0;

    for (const [videoFile, frames] of videoFramesMap) {
      processedCount++;
      analysisSpinner.text = `🤖 AI 分析视频内容 (${processedCount}/${videoFramesMap.size})... ${basename(videoFile)}`;

      try {
        // 为每个视频单独分析
        const analysis = await aiAnalyzer.analyzeImage(frames);

        const newName = fileRenamer.generateNewName(
          videoFile,
          analysis,
          options.format as "semantic" | "structured",
        );

        if (!options.dryRun) {
          await fileRenamer.renameFile(videoFile, newName);
        }

        results.push({
          originalPath: videoFile,
          newName,
          analysis,
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

    analysisSpinner.succeed(
      `✅ 完成 ${videoFramesMap.size} 个视频AI分析与重命名`,
    );

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
