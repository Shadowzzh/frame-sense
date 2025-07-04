import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import chalk from "chalk";
import { glob } from "glob";
import ora from "ora";
import { AIAnalyzer } from "./ai-analyzer.js";
import type { FrameSenseOptions } from "./config.js";
import {
  IMAGE_EXTENSIONS,
  type ImageExtension,
  VIDEO_EXTENSIONS,
  type VideoExtension,
} from "./constants";
import { FileRenamer } from "./file-renamer.js";
import { FrameExtractor } from "./frame-extractor.js";

/**
 * 处理文件
 * @param options 配置选项
 */
export async function processFiles(
  options: FrameSenseOptions & { directory?: string; files?: string[] },
) {
  const spinner = ora("正在扫描文件...").start();

  try {
    // 获取要处理的文件列表
    const files = await getFileList(options);

    if (files.length === 0) {
      spinner.fail("未找到可处理的文件");
      return;
    }

    spinner.succeed(`发现 ${files.length} 个文件待处理`);

    console.log(chalk.gray("文件列表:"));
    for (const file of files) {
      console.log(chalk.gray(`  - ${file}`));
    }
    console.log();

    // 初始化处理器
    const frameExtractor = new FrameExtractor();
    const aiAnalyzer = new AIAnalyzer(options);
    const fileRenamer = new FileRenamer(options);

    const results: ProcessResult[] = [];
    // 按文件类型分组
    const { imageFiles, videoFiles } = categorizeFiles(files);

    // 统一处理所有文件
    const allResults = await processAllFiles(
      { imageFiles, videoFiles },
      { frameExtractor, aiAnalyzer, fileRenamer, options },
    );
    results.push(...allResults);

    // 显示统计信息
    _displayStats(aiAnalyzer);

    // 显示结果
    _displayResults(results, options);
  } catch (error) {
    spinner.fail(`处理失败: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

/**
 * 获取文件列表
 * @param options 配置选项
 * @returns 文件列表
 */
async function getFileList(
  options: FrameSenseOptions & { directory?: string; files?: string[] },
): Promise<string[]> {
  const files: string[] = [];

  // 处理指定的文件列表
  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      // 检查文件是否存在且是文件
      if (existsSync(file) && statSync(file).isFile()) {
        files.push(file);
      }
    }
  }

  // 处理指定的目录
  if (options.directory) {
    if (!existsSync(options.directory)) {
      throw new Error(`目录不存在: ${options.directory}`);
    }

    if (!statSync(options.directory).isDirectory()) {
      throw new Error(`路径不是目录: ${options.directory}`);
    }

    const patterns = [
      ...VIDEO_EXTENSIONS.map((ext) => `**/*${ext}`),
      ...IMAGE_EXTENSIONS.map((ext) => `**/*${ext}`),
    ];

    for (const pattern of patterns) {
      const matchedFiles = await glob(pattern, {
        cwd: options.directory,
        absolute: true,
        nodir: true,
      });
      files.push(...matchedFiles);
    }
  }

  // 去重并排序
  return [...new Set(files)].sort();
}

interface ProcessResult {
  /** 原始路径 */
  originalPath: string;
  /** 新名称 */
  newName?: string;
  /** 分析 */
  analysis?: string;
  /** 是否成功 */
  success: boolean;
  /** 错误 */
  error?: string;
}

interface ProcessContext {
  /** 帧提取器 */
  frameExtractor?: FrameExtractor;
  /** AI 分析器 */
  aiAnalyzer: AIAnalyzer;
  /** 文件重命名器 */
  fileRenamer: FileRenamer;
  /** 配置选项 */
  options: FrameSenseOptions;
}

/**
 * 按文件类型分类
 */
function categorizeFiles(files: string[]): {
  imageFiles: string[];
  videoFiles: string[];
} {
  const imageFiles: string[] = [];
  const videoFiles: string[] = [];

  for (const file of files) {
    const fileExtension = extname(file).toLowerCase().slice(1); // 去掉开头的 .
    if (IMAGE_EXTENSIONS.includes(fileExtension as ImageExtension)) {
      imageFiles.push(file);
    } else if (VIDEO_EXTENSIONS.includes(fileExtension as VideoExtension)) {
      videoFiles.push(file);
    }
  }

  return { imageFiles, videoFiles };
}

/**
 * 统一处理所有文件
 */
async function processAllFiles(
  files: { imageFiles: string[]; videoFiles: string[] },
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { frameExtractor, aiAnalyzer, fileRenamer, options } = context;
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
    const imageSpinner = ora(`📸 处理 ${imageFiles.length} 张图片...`).start();

    try {
      // AI 分析
      const analysis = await aiAnalyzer.analyzeImage(imageFiles);
      // 如果分析结果包含 "|||"，则将分析结果按 "|||" 分割
      const descriptions = analysis.includes("|||")
        ? analysis.split("|||")
        : imageFiles.map(() => analysis);

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileAnalysis = descriptions[i] || analysis;

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

      imageSpinner.succeed(`✅ 完成 ${imageFiles.length} 张图片处理`);
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
  }

  // 处理视频文件
  if (videoFiles.length > 0) {
    const videoSpinner = ora(`🎬 处理 ${videoFiles.length} 个视频...`).start();

    try {
      const videoFramesMap = new Map<string, string[]>();

      // 提取关键帧
      for (const videoFile of videoFiles) {
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

      // AI 分析并重命名每个视频文件
      if (videoFramesMap.size > 0) {
        for (const [videoFile, frames] of videoFramesMap) {
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

        // 清理临时文件
        for (const frames of videoFramesMap.values()) {
          try {
            await frameExtractor?.cleanupFrames(frames);
          } catch {
            // 忽略清理错误
          }
        }
      }

      videoSpinner.succeed(`✅ 完成 ${videoFiles.length} 个视频处理`);
    } catch (error) {
      videoSpinner.fail(
        `❌ 视频处理失败: ${error instanceof Error ? error.message : error}`,
      );

      for (const videoFile of videoFiles) {
        if (!results.some((r) => r.originalPath === videoFile)) {
          results.push({
            originalPath: videoFile,
            error: error instanceof Error ? error.message : String(error),
            success: false,
          });
        }
      }
    }
  }

  return results;
}

/**
 * 显示统计信息
 * @param aiAnalyzer AI 分析器
 */
function _displayStats(aiAnalyzer: AIAnalyzer) {
  const stats = aiAnalyzer.getStats();

  if (stats.totalFiles === 0) {
    return;
  }

  console.log();
  console.log(chalk.cyan("📊 AI 分析统计信息:"));
  console.log();

  console.log(chalk.gray(`  📁 处理文件数: ${stats.totalFiles} 个`));
  console.log(chalk.gray(`  📏 文件总大小: ${_formatBytes(stats.totalSize)}`));
  console.log(
    chalk.gray(`  🔢 预估 Token: ${stats.estimatedTokens.toLocaleString()}`),
  );
  console.log(
    chalk.gray(`  📤 发送数据量: ${_formatBytes(stats.sentDataSize)}`),
  );
  console.log();
}

/**
 * 格式化字节数
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
function _formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * 显示处理结果
 * @param results 处理结果
 * @param options 配置选项
 */
function _displayResults(results: ProcessResult[], options: FrameSenseOptions) {
  console.log();
  console.log(chalk.bold("处理结果:"));
  console.log();

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // 成功处理的文件
  if (successful.length > 0) {
    console.log(chalk.green(`✓ 成功处理 ${successful.length} 个文件:`));
    console.log();

    for (const result of successful) {
      console.log(chalk.gray(`  原名: ${basename(result.originalPath)}`));
      console.log(chalk.green(`  新名: ${result.newName}`));
      console.log();
    }
  }

  // 失败处理的文件
  if (failed.length > 0) {
    console.log(chalk.red(`✗ 失败 ${failed.length} 个文件:`));
    console.log();

    for (const result of failed) {
      console.log(chalk.red(`  文件: ${basename(result.originalPath)}`));
      console.log(chalk.red(`  错误: ${result.error}`));
      console.log();
    }
  }

  // 预览模式
  if (options.dryRun) {
    console.log(chalk.yellow("这是预览模式，未执行实际重命名"));
  }
}
