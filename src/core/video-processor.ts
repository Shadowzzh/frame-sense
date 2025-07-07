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

  // AI 批量分析并重命名视频文件
  if (videoFramesMap.size > 0) {
    const analysisSpinner = ora(`🤖 AI 批量分析视频内容...`).start();

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

      analysisSpinner.text = `🤖 处理分析结果与重命名...`;

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

      analysisSpinner.succeed(
        `✅ 完成 ${videoFramesMap.size} 个视频AI批量分析与重命名`,
      );
    } catch (error) {
      analysisSpinner.fail("❌ AI 批量分析失败");

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
