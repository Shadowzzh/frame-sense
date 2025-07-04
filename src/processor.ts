import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import chalk from "chalk";
import cliProgress from "cli-progress";
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

    if (options.verbose) {
      console.log(chalk.gray("文件列表:"));
      for (const file of files) {
        console.log(chalk.gray(`  - ${file}`));
      }
      console.log();
    }

    // 创建进度条
    const progressBar = new cliProgress.SingleBar({
      format: `${chalk.cyan("处理进度")} [{bar}] {percentage}% | {value}/{total} 文件`,
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    progressBar.start(files.length, 0);

    // 初始化处理器
    const frameExtractor = new FrameExtractor();
    // 初始化 AI 分析器
    const aiAnalyzer = new AIAnalyzer(options);
    // 初始化文件重命名器
    const fileRenamer = new FileRenamer(options);

    const results: ProcessResult[] = [];
    // 按文件类型分组
    const { imageFiles, videoFiles } = categorizeFiles(files);

    let processedCount = 0;

    // 批量处理图片文件
    if (imageFiles.length > 0) {
      console.log(chalk.blue(`\n🖼️  开始处理 ${imageFiles.length} 张图片`));
      const imageResults = await processBatchImages(imageFiles, {
        aiAnalyzer,
        fileRenamer,
        options,
      });
      results.push(...imageResults);
      processedCount += imageFiles.length;
      progressBar.update(processedCount);
    } else {
      console.log(chalk.blue(`\n🖼️  没有找到图片文件`));
    }

    // 批量处理视频文件
    if (videoFiles.length > 0) {
      console.log(chalk.blue(`\n🎬 开始处理 ${videoFiles.length} 个视频文件`));
      const videoResults = await processBatchVideos(videoFiles, {
        frameExtractor,
        aiAnalyzer,
        fileRenamer,
        options,
      });
      results.push(...videoResults);
      processedCount += videoFiles.length;
      progressBar.update(processedCount);
    } else {
      console.log(chalk.blue(`\n🎬 没有找到视频文件`));
    }

    progressBar.stop();

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
  originalPath: string;
  newName?: string;
  analysis?: string;
  success: boolean;
  error?: string;
}

interface ProcessContext {
  frameExtractor?: FrameExtractor;
  aiAnalyzer: AIAnalyzer;
  fileRenamer: FileRenamer;
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
 * 批量处理图片文件
 */
async function processBatchImages(
  imageFiles: string[],
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { aiAnalyzer, fileRenamer, options } = context;
  const results: ProcessResult[] = [];

  if (imageFiles.length === 0) {
    return results;
  }

  const imageSpinner = ora(
    `📸 AI 分析 ${imageFiles.length} 张图片中...`,
  ).start();

  try {
    // 批量分析所有图片
    const analysis = await aiAnalyzer.analyzeImage(imageFiles);
    imageSpinner.succeed(`✨ 完成 ${imageFiles.length} 张图片的 AI 分析`);

    // 解析批量分析结果
    const descriptions = analysis.includes("|||")
      ? analysis.split("|||")
      : imageFiles.map(() => analysis); // 回退到统一描述

    // 开始重命名阶段
    const renameSpinner = ora(
      `🔄 重命名 ${imageFiles.length} 张图片中...`,
    ).start();

    // 为每个图片生成新名称并执行重命名
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileAnalysis = descriptions[i] || analysis;

      // 更新当前处理的文件
      renameSpinner.text = `🔄 重命名图片 ${i + 1}/${imageFiles.length}: ${basename(file)}`;

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
      `❌ 图片 AI 分析失败: ${error instanceof Error ? error.message : error}`,
    );

    // 如果批量分析失败，标记所有文件为失败
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
 * 批量处理视频文件
 */
async function processBatchVideos(
  videoFiles: string[],
  context: ProcessContext,
): Promise<ProcessResult[]> {
  const { frameExtractor, aiAnalyzer, fileRenamer, options } = context;
  const results: ProcessResult[] = [];

  if (videoFiles.length === 0 || !frameExtractor) {
    return results;
  }

  // 存储每个视频的帧路径
  const videoFramesMap = new Map<string, string[]>();
  const allFrames: string[] = [];

  // 第一阶段：提取关键帧
  const extractSpinner = ora(
    `🎬 提取 ${videoFiles.length} 个视频的关键帧...`,
  ).start();

  try {
    // 为所有视频提取关键帧
    for (let i = 0; i < videoFiles.length; i++) {
      const videoFile = videoFiles[i];
      extractSpinner.text = `🎬 提取关键帧 ${i + 1}/${videoFiles.length}: ${basename(videoFile)}`;

      try {
        const frames = await frameExtractor.extractFrames(
          videoFile,
          options.frames,
        );
        videoFramesMap.set(videoFile, frames);
        allFrames.push(...frames);
      } catch (error) {
        results.push({
          originalPath: videoFile,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }

    extractSpinner.succeed(
      `✅ 完成 ${videoFiles.length} 个视频的关键帧提取，共 ${allFrames.length} 帧`,
    );

    // 第二阶段：AI 分析
    if (allFrames.length > 0) {
      const analyzeSpinner = ora(
        `🧠 AI 分析 ${allFrames.length} 帧图像中...`,
      ).start();

      const analysis = await aiAnalyzer.analyzeImage(allFrames);
      analyzeSpinner.succeed(`✨ 完成 ${allFrames.length} 帧的 AI 分析`);

      // 第三阶段：重命名
      const renameSpinner = ora(
        `🔄 重命名 ${videoFiles.length} 个视频文件中...`,
      ).start();

      // 为每个视频生成新名称并执行重命名
      let processedVideoCount = 0;
      for (const [videoFile, _frames] of videoFramesMap) {
        processedVideoCount++;
        renameSpinner.text = `🔄 重命名视频 ${processedVideoCount}/${videoFramesMap.size}: ${basename(videoFile)}`;

        try {
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

      renameSpinner.succeed(`✅ 完成 ${videoFiles.length} 个视频重命名`);
    }
  } catch (error) {
    extractSpinner.fail(
      `❌ 视频处理失败: ${error instanceof Error ? error.message : error}`,
    );

    // 如果处理失败，标记所有未处理的文件为失败
    for (const videoFile of videoFiles) {
      if (!results.some((r) => r.originalPath === videoFile)) {
        results.push({
          originalPath: videoFile,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        });
      }
    }
  } finally {
    // 清理所有临时帧文件
    const cleanupSpinner = ora(
      `🧹 清理 ${videoFramesMap.size} 个视频的临时文件...`,
    ).start();

    for (const frames of videoFramesMap.values()) {
      try {
        await frameExtractor.cleanupFrames(frames);
      } catch {
        // 忽略清理错误
      }
    }

    cleanupSpinner.succeed(`✅ 完成临时文件清理`);
  }

  return results;
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
      if (options.verbose) {
        console.log(chalk.gray(`  分析: ${result.analysis}`));
      }
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
