/**
 * UI 工具类
 * 提供彩色终端输出、进度指示、结果展示等用户界面功能
 */

import boxen from "boxen";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import type {
  AnalysisResult,
  AppConfig,
  BatchProcessingStats,
  RenameResult,
} from "@/types";
import { FileUtils } from "./file-utils";

export class UIUtils {
  /**
   * 创建加载动画
   * @param text - 显示文本
   * @returns Ora 实例
   */
  static createSpinner(text: string): Ora {
    return ora({
      text: chalk.green(text),
      spinner: "aesthetic",
      color: "green",
    });
  }

  /**
   * 记录成功消息
   * @param message - 消息内容
   */
  static logSuccess(message: string): void {
    console.log(chalk.green("✓"), message);
  }

  /**
   * 记录错误消息
   * @param message - 消息内容
   */
  static logError(message: string): void {
    console.log(chalk.red("✗"), message);
  }

  /**
   * 记录警告消息
   * @param message - 消息内容
   */
  static logWarning(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  }

  /**
   * 记录信息消息
   * @param message - 消息内容
   */
  static logInfo(message: string): void {
    console.log(chalk.blue("ℹ"), message);
  }

  /**
   * 记录调试消息
   * @param message - 消息内容
   */
  static logDebug(message: string): void {
    console.log(chalk.gray("🔍"), message);
  }

  /**
   * 格式化文件信息
   * @param path - 文件路径
   * @param size - 文件大小
   * @returns 格式化的文件信息
   */
  static formatFileInfo(path: string, size: number): string {
    const fileName = path.split("/").pop() || path;
    const formattedSize = FileUtils.formatFileSize(size);
    return `${chalk.cyan(fileName)} ${chalk.gray(`(${formattedSize})`)}`;
  }

  /**
   * 打印分析结果
   * @param results - 分析结果列表
   */
  static printAnalysisResults(results: AnalysisResult[]): void {
    console.log(chalk.bold("\n 分析结果:"));
    console.log("─".repeat(80));

    results.forEach((result, index) => {
      const confidenceColor =
        result.confidence >= 80
          ? "green"
          : result.confidence >= 60
            ? "yellow"
            : "red";

      console.log(
        `${chalk.bold(`${index + 1}.`)} ${chalk.cyan(result.filename)}`,
      );
      console.log(
        `   ${chalk.gray("置信度:")} ${chalk[confidenceColor](`${result.confidence}%`)}`,
      );
      console.log(`   ${chalk.gray("描述:")} ${result.description}`);
      if (result.tags.length > 0) {
        console.log(
          `   ${chalk.gray("标签:")} ${result.tags.map((tag) => chalk.magenta(tag)).join(", ")}`,
        );
      }
      console.log();
    });
  }

  /**
   * 打印重命名结果
   * @param results - 重命名结果列表
   */
  static printRenameResults(results: RenameResult[]): void {
    console.log(chalk.bold("\n 重命名结果:"));
    console.log("─".repeat(80));

    results.forEach((result, index) => {
      const originalName =
        result.originalPath.split("/").pop() || result.originalPath;
      const newName = result.newPath.split("/").pop() || result.newPath;

      if (result.success) {
        console.log(
          `${chalk.green("✓")} ${chalk.bold(`${index + 1}.`)} ${chalk.cyan(originalName)} → ${chalk.green(newName)}`,
        );
        console.log(
          `   ${chalk.gray("置信度:")} ${UIUtils.formatConfidence(result.analysisResult.confidence)}`,
        );
      } else {
        console.log(
          `${chalk.red("✗")} ${chalk.bold(`${index + 1}.`)} ${chalk.cyan(originalName)} → ${chalk.red("失败")}`,
        );
        console.log(`   ${chalk.red("错误:")} ${result.error}`);
      }
      console.log();
    });
  }

  /**
   * 打印重命名预览
   * @param previews - 预览信息列表
   */
  static printRenamePreview(
    previews: { originalName: string; newName: string; confidence: number }[],
  ): void {
    console.log(chalk.bold("\n 重命名预览:"));
    console.log("─".repeat(80));

    previews.forEach((preview, index) => {
      console.log(
        `${chalk.bold(`${index + 1}.`)} ${chalk.cyan(preview.originalName)} → ${chalk.green(preview.newName)}`,
      );
      console.log(
        `   ${chalk.gray("置信度:")} ${UIUtils.formatConfidence(preview.confidence)}`,
      );
      console.log();
    });
  }

  /**
   * 打印统计信息
   * @param stats - 统计数据
   */
  static printStatistics(stats: BatchProcessingStats): void {
    console.log(chalk.bold("\n 统计信息:"));
    console.log("─".repeat(50));
    console.log(`${chalk.gray("总文件数:")} ${chalk.bold(stats.totalFiles)}`);
    console.log(`${chalk.gray("成功:")} ${chalk.green(stats.successfulFiles)}`);
    console.log(`${chalk.gray("失败:")} ${chalk.red(stats.failedFiles)}`);
    console.log(
      `${chalk.gray("平均置信度:")} ${UIUtils.formatConfidence(stats.averageConfidence)}`,
    );
    console.log(
      `${chalk.gray("处理时间:")} ${chalk.bold((stats.totalProcessingTime / 1000).toFixed(2))}s`,
    );
    console.log(`${chalk.gray("使用 Token:")} ${chalk.bold(stats.tokensUsed)}`);

    // 批次统计
    if (stats.batchStats.totalBatches > 1) {
      console.log(chalk.bold("\n 批次统计:"));
      console.log(
        `${chalk.gray("总批次:")} ${chalk.bold(stats.batchStats.totalBatches)}`,
      );
      console.log(
        `${chalk.gray("成功批次:")} ${chalk.green(stats.batchStats.successfulBatches)}`,
      );
      console.log(
        `${chalk.gray("失败批次:")} ${chalk.red(stats.batchStats.failedBatches)}`,
      );
    }
    console.log();
  }

  /**
   * 打印处理时间
   * @param timeMs - 处理时间（毫秒）
   */
  static printProcessingTime(timeMs: number): void {
    const seconds = (timeMs / 1000).toFixed(2);
    console.log(`${chalk.gray("处理时间:")} ${chalk.bold(seconds)}s`);
  }

  /**
   * 打印支持的格式
   */
  static printSupportedFormats(): void {
    const formats = FileUtils.getSupportedFormats();

    console.log(chalk.bold("\n📄 支持的格式:"));
    console.log("─".repeat(40));

    console.log(chalk.bold("图像:"));
    console.log(`  ${formats.images.map((f) => chalk.cyan(f)).join(", ")}`);

    console.log(chalk.bold("\n视频:"));
    console.log(`  ${formats.videos.map((f) => chalk.cyan(f)).join(", ")}`);
    console.log();
  }

  /**
   * 打印配置信息
   * @param config - 配置对象
   */
  static printConfigInfo(config: AppConfig): void {
    console.log(chalk.bold("\n⚙️  配置信息:"));
    console.log("─".repeat(50));

    // API 配置
    console.log(chalk.bold("API 配置:"));
    const maskedApiKey = `${config.api || "(未设置)"}`;
    console.log(`  ${chalk.gray("API Key:")} ${chalk.yellow(maskedApiKey)}`);
    console.log(`  ${chalk.gray("模型:")} ${chalk.cyan(config.defaultModel)}`);

    // 图像处理配置
    console.log(chalk.bold("\n图像处理:"));
    console.log(
      `  ${chalk.gray("质量:")} ${chalk.cyan(config.imageProcessing.quality)}%`,
    );
    console.log(
      `  ${chalk.gray("最大尺寸:")} ${chalk.cyan(`${config.imageProcessing.maxWidth}x${config.imageProcessing.maxHeight}`)}`,
    );
    console.log(
      `  ${chalk.gray("保持比例:")} ${chalk.cyan(config.imageProcessing.keepAspectRatio ? "是" : "否")}`,
    );

    // 批量处理配置
    console.log(chalk.bold("\n批量处理:"));
    console.log(
      `  ${chalk.gray("批次大小:")} ${chalk.cyan(config.batchProcessing.batchSize)}`,
    );
    console.log(
      `  ${chalk.gray("最大 Token:")} ${chalk.cyan(config.batchProcessing.maxTokens)}`,
    );
    console.log(
      `  ${chalk.gray("并行处理:")} ${chalk.cyan(config.batchProcessing.parallel ? "是" : "否")}`,
    );

    // 其他设置
    console.log(chalk.bold("\n其他:"));
    console.log(
      `  ${chalk.gray("帧提取策略:")} ${chalk.cyan(config.frameExtractionStrategy)}`,
    );
    console.log(
      `  ${chalk.gray("调试模式:")} ${chalk.cyan(config.debug ? "是" : "否")}`,
    );
    console.log(
      `  ${chalk.gray("详细输出:")} ${chalk.cyan(config.verbose ? "是" : "否")}`,
    );
    console.log();
  }

  /**
   * 打印标题
   * @param title - 标题内容
   */
  static printHeader(title: string): void {
    console.log();
    console.log(
      boxen(chalk.bold.white(title), {
        padding: 1,
        margin: 0,
        borderStyle: "round",
        borderColor: "cyan",
        textAlignment: "center",
        width: 60,
      }),
    );
    console.log();
  }

  /**
   * 格式化置信度
   * @param confidence - 置信度值
   * @returns 格式化的置信度字符串
   */
  static formatConfidence(confidence: number): string {
    if (confidence >= 80) return chalk.green(`${confidence}%`);
    if (confidence >= 60) return chalk.yellow(`${confidence}%`);
    return chalk.red(`${confidence}%`);
  }

  /**
   * 打印进度条
   * @param current - 当前进度
   * @param total - 总数
   * @param text - 描述文本
   */
  static printProgressBar(current: number, total: number, text: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((current / total) * barLength);
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

    process.stdout.write(
      `\r${chalk.cyan(bar)} ${chalk.bold(`${percentage}%`)} ${text}`,
    );

    if (current === total) {
      process.stdout.write("\n");
    }
  }

  /**
   * 清除当前行
   */
  static clearLine(): void {
    process.stdout.write(`\r${" ".repeat(process.stdout.columns || 80)}\r`);
  }

  /**
   * 打印依赖检查结果
   * @param deps - 依赖检查结果
   */
  static printDependencyCheck(deps: {
    ffmpeg: { available: boolean; version?: string; error?: string };
    ffprobe: { available: boolean; version?: string; error?: string };
  }): void {
    console.log(chalk.bold("\n🔍 依赖检查:"));
    console.log("─".repeat(40));

    // FFmpeg
    if (deps.ffmpeg.available) {
      console.log(
        `${chalk.green("✓")} FFmpeg: ${chalk.cyan(deps.ffmpeg.version || "可用")}`,
      );
    } else {
      console.log(
        `${chalk.red("✗")} FFmpeg: ${chalk.red(deps.ffmpeg.error || "不可用")}`,
      );
    }

    // FFprobe
    if (deps.ffprobe.available) {
      console.log(
        `${chalk.green("✓")} FFprobe: ${chalk.cyan(deps.ffprobe.version || "可用")}`,
      );
    } else {
      console.log(
        `${chalk.red("✗")} FFprobe: ${chalk.red(deps.ffprobe.error || "不可用")}`,
      );
    }

    console.log();
  }

  /**
   * 打印 API 测试结果
   * @param result - 测试结果
   */
  static printAPITestResult(result: {
    success: boolean;
    error?: string;
    model?: string;
  }): void {
    console.log(chalk.bold("\n🧪 API 连接测试:"));
    console.log("─".repeat(40));

    if (result.success) {
      console.log(`${chalk.green("✓")} API 连接成功`);
      if (result.model) {
        console.log(`${chalk.gray("模型:")} ${chalk.cyan(result.model)}`);
      }
    } else {
      console.log(`${chalk.red("✗")} API 连接失败`);
      if (result.error) {
        console.log(`${chalk.red("错误:")} ${result.error}`);
      }
    }
    console.log();
  }

  /**
   * 打印帮助信息
   */
  static printHelp(): void {
    console.log(chalk.bold("\n🎯 Frame Sense - 智能媒体文件重命名工具"));
    console.log("─".repeat(60));
    console.log();

    console.log(chalk.bold("用法:"));
    console.log("  frame-sense [选项] <文件路径>");
    console.log("  fren [选项] <文件路径>");
    console.log();

    console.log(chalk.bold("选项:"));
    console.log(
      `  ${chalk.cyan("-d, --directory")}     分析整个目录中的媒体文件`,
    );
    console.log(`  ${chalk.cyan("-t, --test")}          测试 AI API 连接`);
    console.log(
      `  ${chalk.cyan("-p, --preview")}       预览重命名结果，不实际执行`,
    );
    console.log(`  ${chalk.cyan("-o, --output <dir>")}  指定输出目录`);
    console.log(`  ${chalk.cyan("-b, --batch <size>")}  设置批量处理大小`);
    console.log(`  ${chalk.cyan("--debug")}             启用调试模式`);
    console.log(`  ${chalk.cyan("--verbose")}           启用详细输出`);
    console.log(`  ${chalk.cyan("--config <file>")}     指定配置文件路径`);
    console.log(`  ${chalk.cyan("-h, --help")}          显示帮助信息`);
    console.log(`  ${chalk.cyan("-v, --version")}       显示版本信息`);
    console.log();

    console.log(chalk.bold("示例:"));
    console.log(`  ${chalk.gray("# 重命名单个文件")}`);
    console.log(`  frame-sense photo.jpg`);
    console.log();

    console.log(`  ${chalk.gray("# 分析整个目录")}`);
    console.log(`  frame-sense -d /path/to/images`);
    console.log();

    console.log(`  ${chalk.gray("# 预览重命名结果")}`);
    console.log(`  frame-sense -p -d /path/to/videos`);
    console.log();

    console.log(`  ${chalk.gray("# 测试 API 连接")}`);
    console.log(`  frame-sense -t`);
    console.log();

    console.log(chalk.bold("环境变量:"));
    console.log(
      `  ${chalk.cyan("FRAME_SENSE_API_KEY")}      Google Gemini API Key`,
    );
    console.log(`  ${chalk.cyan("FRAME_SENSE_BATCH_SIZE")}   批量处理大小`);
    console.log(
      `  ${chalk.cyan("FRAME_SENSE_DEBUG")}        启用调试模式 (true/false)`,
    );
    console.log(
      `  ${chalk.cyan("FRAME_SENSE_VERBOSE")}      启用详细输出 (true/false)`,
    );
    console.log();
  }

  /**
   * 询问用户确认
   * @param message - 确认消息
   * @returns 用户确认结果
   */
  static async askConfirmation(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      process.stdout.write(
        `${chalk.yellow("?")} ${message} ${chalk.gray("(Y/n)")}: `,
      );

      process.stdin.once("data", (data) => {
        const answer = data.toString().trim().toLowerCase();
        resolve(answer !== "n" && answer !== "no");
      });
    });
  }

  /**
   * 打印分隔线
   * @param length - 分隔线长度
   * @param char - 分隔字符
   */
  static printSeparator(length = 50, char = "─"): void {
    console.log(chalk.gray(char.repeat(length)));
  }
}
