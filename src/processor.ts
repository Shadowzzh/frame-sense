import chalk from "chalk";
import ora from "ora";
import { AIAnalyzer } from "@/ai-analyzer";
import type { FrameSenseOptions } from "@/config";
import { processAllFiles } from "@/core/file-processor";
import { categorizeFiles, getFileList } from "@/core/file-scanner";
import { FileRenamer } from "@/file-renamer";
import { FrameExtractor } from "@/frame-extractor";
import { checkFFmpegSuite, showFFmpegError } from "@/utils/ffmpeg-checker";
import { displayResults } from "@/utils/result-formatter";
import { getSignalHandler } from "@/utils/signal-handler";
import { displayStats } from "@/utils/stats-collector";

interface ProcessFilesOptions extends FrameSenseOptions {
  /** 文件目录 */
  directory?: string;
  /** 文件列表 */
  files?: string[];
}

/**
 * 处理文件
 * @param options 配置选项
 */
export async function processFiles(options: ProcessFilesOptions) {
  // 检查 FFmpeg 依赖
  const ffmpegCheckSpinner = ora("正在检查 FFmpeg 依赖...").start();
  const ffmpegCheck = await checkFFmpegSuite();

  if (!ffmpegCheck.allAvailable) {
    ffmpegCheckSpinner.fail();
    showFFmpegError(ffmpegCheck);
    throw new Error("FFmpeg 依赖不可用，无法处理视频文件");
  }

  ffmpegCheckSpinner.succeed("FFmpeg 依赖检查通过");

  const spinner = ora("正在扫描文件...").start();
  // 初始化信号处理器
  const signalHandler = getSignalHandler();

  try {
    // 获取要处理的文件列表
    const files = await getFileList(options);

    if (files.length === 0) {
      spinner.fail("未找到可处理的文件");
      return;
    }

    spinner.succeed(`发现 ${files.length} 个文件待处理`);

    if (options.verbose) {
      console.log(chalk.blue("📋 详细模式已启用"));
      console.log(
        chalk.blue(`📁 处理目录: ${options.directory || "使用文件列表"}`),
      );
      console.log(chalk.blue(`🎯 命名格式: ${options.format}`));
      console.log(chalk.blue(`🎬 帧数: ${options.frames}`));
      console.log(chalk.blue(`🔄 预览模式: ${options.dryRun ? "是" : "否"}`));
      console.log(chalk.blue(`🤖 模型: ${options.model}`));
    }

    console.log(chalk.gray("文件列表:"));
    for (const file of files) {
      console.log(chalk.gray(`  - ${file}`));
    }
    console.log();

    // 初始化帧提取器
    const frameExtractor = new FrameExtractor(options);

    // 注册清理函数 - 清理临时帧文件
    const cleanupFrames = () => {
      frameExtractor.cleanup();
    };

    // 注册清理函数
    signalHandler.addCleanupFunction(cleanupFrames);

    // 初始化 AI 分析器
    const aiAnalyzer = new AIAnalyzer(options);

    // 初始化文件重命名器
    const fileRenamer = new FileRenamer(options);

    // 按文件类型分组
    const categorizedFiles = categorizeFiles(files);

    if (options.verbose) {
      console.log(chalk.blue("📊 文件分类统计:"));
      console.log(
        chalk.blue(`  - 图片文件: ${categorizedFiles.imageFiles.length} 个`),
      );
      console.log(
        chalk.blue(`  - 视频文件: ${categorizedFiles.videoFiles.length} 个`),
      );
    }

    // 处理所有文件
    const results = await processAllFiles(categorizedFiles, {
      frameExtractor,
      aiAnalyzer,
      fileRenamer,
      options,
    });

    // 处理完成后移除清理函数
    signalHandler.removeCleanupFunction(cleanupFrames);

    // 显示统计信息
    displayStats(aiAnalyzer);

    // 显示结果
    displayResults(results, options);
  } catch (error) {
    spinner.fail(`处理失败: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}
