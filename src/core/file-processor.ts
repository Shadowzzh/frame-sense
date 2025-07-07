/**
 * 文件处理器 - 统一处理入口
 */

import chalk from "chalk";
import { processImages } from "@/core/image-processor";
import { processVideos } from "@/core/video-processor";
import type { CategorizedFiles, ProcessContext, ProcessResult } from "@/types";

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
  console.log(chalk.blue(`\n📋 开始处理 ${totalFiles} 个文件`));

  if (imageFiles.length > 0) {
    console.log(chalk.gray(`  - 图片: ${imageFiles.length} 张`));
  }
  if (videoFiles.length > 0) {
    console.log(chalk.gray(`  - 视频: ${videoFiles.length} 个`));
  }

  // 处理图片文件
  if (imageFiles.length > 0) {
    if (context.options.verbose) {
      console.log(chalk.blue("🖼️  开始处理图片文件..."));
    }
    const imageResults = await processImages(imageFiles, context);
    results.push(...imageResults);
    if (context.options.verbose) {
      console.log(
        chalk.blue(`✅ 图片处理完成，共处理 ${imageResults.length} 张`),
      );
    }
  }

  // 处理视频文件
  if (videoFiles.length > 0) {
    if (context.options.verbose) {
      console.log(chalk.blue("🎬 开始处理视频文件..."));
    }
    const videoResults = await processVideos(videoFiles, context);
    results.push(...videoResults);
    if (context.options.verbose) {
      console.log(
        chalk.blue(`✅ 视频处理完成，共处理 ${videoResults.length} 个`),
      );
    }
  }

  return results;
}
