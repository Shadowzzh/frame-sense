/**
 * 图片处理器
 */

import { basename } from "node:path";
import chalk from "chalk";
import ora from "ora";
import type { ProcessContext, ProcessResult } from "@/types";

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

  console.log(chalk.blue(`\n📸 开始处理 ${imageFiles.length} 张图片`));

  const imageSpinner = ora(`🤖 AI 分析图片内容...`).start();

  try {
    // AI 分析
    const analysis = await aiAnalyzer.analyzeImage(imageFiles);
    // 如果分析结果包含 "|||"，则将分析结果按 "|||" 分割
    const descriptions = analysis.includes("|||")
      ? analysis.split("|||")
      : imageFiles.map(() => analysis);

    imageSpinner.succeed(`✅ AI 分析完成`);

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
    imageSpinner.fail(
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
