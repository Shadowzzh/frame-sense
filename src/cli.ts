#!/usr/bin/env node

/**
 * Frame Sense CLI 主入口文件
 * 智能媒体文件重命名工具
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { AIAnalyzer } from "@/core/ai-analyzer";
import {
  getConfigManager,
  interactiveConfig,
  selectFrameExtractionStrategy,
} from "@/core/config";
import type { CommandOptions, FrameExtractionStrategy } from "@/types";

interface ExtendedCommandOptions extends CommandOptions {
  frameStrategy?: FrameExtractionStrategy | boolean;
}

import { SmartRenamer } from "@/core/renamer";
import { VideoProcessor } from "@/core/video-processor";
import { FileUtils } from "@/utils/file-utils";
import { progressLogger } from "@/utils/progress-logger";
import { getSignalHandler, SignalHandler } from "@/utils/signal-handler";
import { UIUtils } from "@/utils/ui-utils";

const envHttpProxyAgent = new EnvHttpProxyAgent();
setGlobalDispatcher(envHttpProxyAgent);
getSignalHandler();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取版本信息
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

/**
 * 主程序类
 */
class FrameSenseCLI {
  private program: Command;
  private config = getConfigManager();
  private renamer: SmartRenamer | null = null;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  /** 运行 CLI */
  public async run() {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      progressLogger.error(
        `程序执行失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      process.exit(1);
    } finally {
      // 清理资源
      this.renamer?.destroy();
    }
  }

  /** 设置命令行参数 */
  private setupCommands() {
    this.program
      .name("frame-sense")
      .description(packageJson.description)
      .version(packageJson.version)
      .argument("[file]", "要处理的文件或目录路径")
      .option("-t, --test", "测试 AI API 连接")
      .option("-p, --preview", "预览重命名结果，不实际执行")
      .option("-o, --output <dir>", "指定输出目录")
      .option("-b, --batch <size>", "设置批量处理大小", parseInt)
      .option(
        "-f, --frame-strategy [strategy]",
        "设置帧提取策略 (single|multiple|keyframes)，不带值时进入交互选择",
      )
      .option("--test-spinner", "测试进度条动画")
      .option("-v, --verbose", "启用详细输出和调试模式")
      .option("--config", "显示配置信息")
      .option("--formats", "显示支持的格式")
      .option("--deps", "检查依赖")
      .action(
        async (
          filePath: string | undefined,
          options: ExtendedCommandOptions,
        ) => {
          // 处理 frameStrategy 选项映射
          if (options.frameStrategy !== undefined) {
            // 如果 frameStrategy 是 true (表示使用了 --frame-strategy 但没有提供值)
            if (options.frameStrategy === true) {
              // 进入交互式选择模式
              const selectedStrategy = await selectFrameExtractionStrategy();
              if (selectedStrategy) {
                options.frameExtractionStrategy = selectedStrategy;
              }
            } else {
              // 有具体的值
              options.frameExtractionStrategy =
                options.frameStrategy as FrameExtractionStrategy;
            }
            delete options.frameStrategy;
          }
          await this.handleMainCommand(filePath, options as CommandOptions);
        },
      );

    // 添加配置子命令
    this.program
      .command("config")
      .description("配置管理")
      .option("--api <key>", "设置 Google Gemini API Key")
      .option("--batch-size <size>", "设置批量处理大小", parseInt)
      .option("--filename-length <length>", "设置文件名字数长度限制", parseInt)
      .option("--custom-prompt <template>", "设置自定义 prompt 模板")
      .option("--reset-prompt", "重置 prompt 配置到默认值")
      .option("--reset", "重置配置到默认值")
      .action(async (options) => {
        await this.handleSubCommand(options);
      });
  }

  /** 处理主命令 */
  private async handleMainCommand(
    filePath: string | undefined,
    options: CommandOptions,
  ) {
    try {
      // 测试进度条动画
      if (options.testSpinner) {
        progressLogger.startProgress("加载中...");
        await new Promise((r) => setTimeout(r, 100000000));
      }

      // 应用命令行选项到配置
      await this.applyOptionsToConfig(options);

      // 显示支持的格式
      if (options.formats) {
        UIUtils.printSupportedFormats();
        return;
      }

      // 检查依赖
      if (options.deps) {
        const deps = VideoProcessor.checkDependencies();
        UIUtils.printDependencyCheck(deps);
        return;
      }

      // 测试 API 连接
      if (options.test) {
        await this.testAPIConnection();
        return;
      }

      // 测试 API 连接
      if (options.test) {
        await this.testAPIConnection();
        return;
      }

      // 验证输入参数
      if (!filePath) {
        UIUtils.logError("请指定要处理的文件或目录路径");
        return;
      }

      // 检查文件/目录是否存在
      if (!FileUtils.fileExists(filePath)) {
        UIUtils.logError(`文件或目录不存在: ${filePath}`);
        return;
      }

      // 验证配置
      const validation = this.config.validateConfig();
      if (!validation.valid) {
        UIUtils.logError("配置验证失败:");
        validation.errors.forEach((error) => UIUtils.logError(`  ${error}`));
        process.exit(1);
      }

      // 自动判断是文件还是目录并执行对应功能
      const isDirectory = FileUtils.isDirectory(filePath);
      if (isDirectory) {
        await this.processDirectory(filePath, options);
      } else {
        await this.processSingleFile(filePath, options);
      }
    } catch (error) {
      progressLogger.error(
        `执行失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      if (this.config.isVerboseMode()) {
        console.error(error);
      }
      process.exit(1);
    }
  }

  /** 处理子命令 */
  private async handleSubCommand(options: {
    show?: boolean;
    reset?: boolean;
    resetPrompt?: boolean;
    api?: string;
    batchSize?: number;
    filenameLength?: number;
    customPrompt?: string;
  }) {
    try {
      // 重置配置
      if (options.reset) {
        if (await UIUtils.askConfirmation("确定要重置配置到默认值吗？")) {
          this.config.resetConfig();
          UIUtils.logSuccess("配置已重置");
        }
        SignalHandler.shutdown();
        return;
      }

      // 重置 Prompt 配置
      if (options.resetPrompt) {
        if (
          await UIUtils.askConfirmation("确定要重置 Prompt 配置到默认值吗？")
        ) {
          this.config.resetPromptConfig();
          UIUtils.logSuccess("Prompt 配置已重置");
        }
        SignalHandler.shutdown();
        return;
      }

      // 设置配置项
      const configUpdates: {
        api?: string;
        batchSize?: number;
        filenameLength?: number;
        customPrompt?: string;
      } = {};

      if (options.api) {
        configUpdates.api = options.api;
      }
      if (options.batchSize) {
        configUpdates.batchSize = options.batchSize;
      }
      if (options.filenameLength !== undefined) {
        configUpdates.filenameLength = options.filenameLength;
      }

      if (options.customPrompt !== undefined) {
        configUpdates.customPrompt = options.customPrompt;
      }

      if (Object.keys(configUpdates).length > 0) {
        const success = await interactiveConfig(configUpdates);
        if (success) {
          UIUtils.logSuccess("配置已更新");
        } else {
          UIUtils.logError("配置更新失败");
        }
      }

      // 显示配置信息
      UIUtils.printConfigInfo(this.config.getConfig());
    } catch (error) {
      progressLogger.error(
        `配置操作失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  }

  /** 应用命令行选项到配置 */
  private async applyOptionsToConfig(options: CommandOptions) {
    const updates: {
      verbose?: boolean;
      batchSize?: number;
    } = {};

    if (options.verbose !== undefined) {
      updates.verbose = options.verbose;
    }

    if (options.batchSize !== undefined && options.batchSize > 0) {
      updates.batchSize = options.batchSize;
    }

    // 直接应用 frameExtractionStrategy 到配置，而不通过 interactiveConfig
    if (options.frameExtractionStrategy !== undefined) {
      this.config.setFrameExtractionStrategy(options.frameExtractionStrategy);
    }

    if (Object.keys(updates).length > 0) {
      await interactiveConfig(updates);
    }
  }

  /**
   * 测试 API 连接
   */
  private async testAPIConnection(): Promise<void> {
    UIUtils.printHeader("API 连接测试");

    progressLogger.startProgress("测试 API 连接...");

    try {
      const analyzer = new AIAnalyzer();
      const result = await analyzer.testConnection();

      UIUtils.printAPITestResult(result);
      progressLogger.succeedProgress("测试完成");

      analyzer.destroy();
    } catch (error) {
      UIUtils.printAPITestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      progressLogger.failProgress("测试失败");
    }
  }

  /** 处理单个文件 */
  private async processSingleFile(filePath: string, options: CommandOptions) {
    UIUtils.printHeader("处理单个文件");

    const fileInfo = FileUtils.getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`无法获取文件信息: ${filePath}`);
    }

    if (!FileUtils.isMediaFile(filePath)) {
      throw new Error(`不支持的文件格式: ${filePath}`);
    }

    UIUtils.logInfo(`文件类型: ${fileInfo.type}`);
    UIUtils.logInfo(`文件大小: ${FileUtils.formatFileSize(fileInfo.size)}`);

    // AI 处理
    progressLogger.startProgress("AI 正在分析文件...");

    try {
      const result = await this.getRenamer().renameSingleFile(
        filePath,
        options.output,
        options.preview,
      );

      progressLogger.succeedProgress("分析完成");

      // 预览模式
      if (options.preview) {
        const originalName = FileUtils.getFileNameWithoutExtension(
          result.originalPath,
        );

        const newName = FileUtils.getFileNameWithoutExtension(result.newPath);

        UIUtils.printRenamePreview([
          {
            originalName,
            newName,
          },
        ]);
      } else {
        UIUtils.printRenameResults([result]);
      }

      // 显示分析详情
      if (this.config.isVerboseMode()) {
        UIUtils.printAnalysisResults([result.analysisResult]);
      }
    } catch (error) {
      progressLogger.failProgress("分析失败");
      throw error;
    }
  }

  /**
   * 处理目录
   */
  private async processDirectory(
    dirPath: string,
    options: CommandOptions,
  ): Promise<void> {
    UIUtils.printHeader("批量处理目录");

    const mediaFiles = FileUtils.getMediaFiles(dirPath, false);
    if (mediaFiles.length === 0) {
      throw new Error(`目录中没有找到媒体文件: ${dirPath}`);
    }

    UIUtils.logInfo(`找到 ${mediaFiles.length} 个媒体文件`);

    // 按类型统计
    const imageCount = mediaFiles.filter((f) => f.type === "image").length;
    const videoCount = mediaFiles.filter((f) => f.type === "video").length;
    UIUtils.logInfo(`图像文件: ${imageCount} 个，视频文件: ${videoCount} 个`);

    // 确认处理
    if (
      !options.preview &&
      !(await UIUtils.askConfirmation(
        `确定要处理这 ${mediaFiles.length} 个文件吗？`,
      ))
    ) {
      UIUtils.logInfo("操作已取消");
      return;
    }

    progressLogger.startProgress("批量处理文件...");

    try {
      const { results, stats } = await this.getRenamer().batchRenameFiles(
        mediaFiles.map((f) => f.path),
        options.output,
        options.preview,
      );

      progressLogger.succeedProgress("批量处理完成");

      // 显示结果
      if (options.preview) {
        const previews = results.map((r) => ({
          originalName: FileUtils.getFileNameWithoutExtension(r.originalPath),
          newName: FileUtils.getFileNameWithoutExtension(r.newPath),
        }));
        UIUtils.printRenamePreview(previews);
      } else {
        // 显示成功的重命名结果
        const successResults = results.filter((r) => r.success);
        if (successResults.length > 0) {
          UIUtils.printRenameResults(successResults.slice(0, 10)); // 只显示前10个
          if (successResults.length > 10) {
            UIUtils.logInfo(
              `... 还有 ${successResults.length - 10} 个文件重命名成功`,
            );
          }
        }

        // 显示失败的结果
        const failedResults = results.filter((r) => !r.success);
        if (failedResults.length > 0) {
          UIUtils.logWarning(`${failedResults.length} 个文件处理失败:`);
          failedResults.forEach((r) => {
            UIUtils.logError(
              `  ${r.originalPath.split("/").pop()}: ${r.error}`,
            );
          });
        }
      }

      // 显示统计信息
      UIUtils.printStatistics(stats);
    } catch (error) {
      progressLogger.failProgress("批量处理失败");
      throw error;
    }
  }

  /**  获取或创建 SmartRenamer 实例 */
  private getRenamer(): SmartRenamer {
    if (!this.renamer) {
      this.renamer = new SmartRenamer();
    }
    return this.renamer;
  }
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new FrameSenseCLI();
  cli.run().catch((error) => {
    console.error(chalk.red("程序启动失败:"), error);
    process.exit(1);
  });
}
