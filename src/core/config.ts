/**
 * 配置管理系统
 * 提供多层配置支持：命令行参数、配置文件、环境变量
 */

import Conf from "conf";
import type inquirer from "inquirer";
import type {
  AppConfig,
  BatchProcessOptions,
  FilenameTemplateConfig,
  FrameExtractionStrategy,
  ImageProcessOptions,
  PromptConfig,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { safePrompt } from "@/utils/prompt-utils";

export class ConfigManager {
  /** 配置存储实例 */
  private conf: Conf<AppConfig>;
  /** 当前配置 */
  private currentConfig: AppConfig;

  constructor() {
    // 初始化配置存储
    this.conf = new Conf<AppConfig>({
      projectName: "frame-sense",
      configName: "frame-sense",
      defaults: this.getDefaultConfig(),
    });

    // 加载当前配置
    this.currentConfig = this.loadConfig();
  }

  /**
   * 获取默认配置
   * @returns 默认配置对象
   */
  private getDefaultConfig(): AppConfig {
    return {
      api: "",
      defaultModel: "gemini-2.5-flash",
      imageProcessing: {
        quality: 75,
        maxWidth: 1280,
        maxHeight: 720,
        keepAspectRatio: true,
        format: "jpeg",
      },
      batchProcessing: {
        batchSize: 40,
        maxTokens: 1000000,
        parallel: false,
        maxConcurrency: 3,
      },
      promptConfig: {
        filenameLength: 20,
        customTemplate: undefined,
        filenameTemplate: {
          template: undefined,
          dateSource: ["exif", "created", "modified"],
        },
      },
      frameExtractionStrategy: "single",
      tempDirectory: FileUtils.getTempDir(),
    };
  }

  /**
   * 加载配置
   * 优先级：环境变量 > 配置文件 > 默认值
   * @returns 配置对象
   */
  private loadConfig(): AppConfig {
    const config = { ...this.getDefaultConfig() };

    // 从配置文件加载
    const storedConfig = this.conf.store;
    Object.assign(config, storedConfig);

    // 从环境变量加载
    if (process.env.FRAME_SENSE_API_KEY) {
      config.api = process.env.FRAME_SENSE_API_KEY;
    }

    if (process.env.FRAME_SENSE_MODEL) {
      config.defaultModel = process.env.FRAME_SENSE_MODEL;
    }

    if (process.env.FRAME_SENSE_BATCH_SIZE) {
      const batchSize = parseInt(process.env.FRAME_SENSE_BATCH_SIZE, 10);
      if (!Number.isNaN(batchSize) && batchSize > 0) {
        config.batchProcessing.batchSize = batchSize;
      }
    }

    if (process.env.FRAME_SENSE_VERBOSE === "true") {
      config.verbose = true;
    }

    return config;
  }

  /**
   * 获取配置值
   * @param key - 配置键
   * @returns 配置值
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.currentConfig[key];
  }

  /**
   * 设置配置值
   * @param key - 配置键
   * @param value - 配置值
   */
  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.currentConfig[key] = value;
    this.conf.set(key, value);
  }

  /**
   * 获取完整配置对象
   * @returns 配置对象
   */
  public getConfig(): AppConfig {
    return { ...this.currentConfig };
  }

  /**
   * 设置多个配置项
   * @param config - 配置对象
   */
  public setConfig(config: Partial<AppConfig>): void {
    Object.assign(this.currentConfig, config);

    // 更新配置文件
    for (const [key, value] of Object.entries(config)) {
      this.conf.set(key as keyof AppConfig, value);
    }
  }

  /**
   * 重置配置到默认值
   */
  public resetConfig(): void {
    this.currentConfig = this.getDefaultConfig();
    this.conf.clear();
  }

  /**
   * 检查配置是否有效
   * @returns 配置验证结果
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查 API Key
    if (!this.currentConfig.api || this.currentConfig.api.trim() === "") {
      errors.push("API Key 未配置");
    }

    // 检查模型名称
    if (
      !this.currentConfig.defaultModel ||
      this.currentConfig.defaultModel.trim() === ""
    ) {
      errors.push("默认模型名称未配置");
    }

    // 检查图像处理配置
    const imageConfig = this.currentConfig.imageProcessing;
    if (imageConfig.quality < 1 || imageConfig.quality > 100) {
      errors.push("图像质量必须在 1-100 之间");
    }
    if (imageConfig.maxWidth < 1 || imageConfig.maxHeight < 1) {
      errors.push("图像尺寸必须大于 0");
    }

    // 检查批量处理配置
    const batchConfig = this.currentConfig.batchProcessing;
    if (batchConfig.batchSize < 1) {
      errors.push("批量处理大小必须大于 0");
    }
    if (batchConfig.maxTokens < 1) {
      errors.push("最大 Token 数量必须大于 0");
    }
    if (batchConfig.maxConcurrency < 1) {
      errors.push("最大并发数必须大于 0");
    }

    // 检查 Prompt 配置
    const promptConfig = this.currentConfig.promptConfig;
    if (promptConfig.filenameLength < 1) {
      errors.push("文件名长度必须大于 0");
    }
    if (promptConfig.filenameLength > 100) {
      errors.push("文件名长度不能超过 100 个字符");
    }
    if (promptConfig.customTemplate) {
      // 检查自定义模板是否包含不允许的 JSON 格式内容
      const restrictedPatterns = [
        /请按照以下JSON格式返回结果/,
        /\{\s*"results"\s*:\s*\[/,
        /确保为每个图像都提供一个结果/,
        /结果数量必须与图像数量一致/,
      ];

      for (const pattern of restrictedPatterns) {
        if (pattern.test(promptConfig.customTemplate)) {
          errors.push(
            "自定义模板不能包含 JSON 格式要求部分，该部分由系统自动添加",
          );
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取配置文件路径
   * @returns 配置文件路径
   */
  public getConfigPath(): string {
    return this.conf.path;
  }

  /**
   * 导出配置到文件
   * @param filePath - 导出文件路径
   * @returns 是否成功
   */
  public exportConfig(filePath: string): boolean {
    try {
      const config = this.getConfig();
      const configJson = JSON.stringify(config, null, 2);

      // 使用 Node.js 写入文件
      const fs = require("node:fs");
      fs.writeFileSync(filePath, configJson, "utf8");

      return true;
    } catch (error) {
      console.error("导出配置失败:", error);
      return false;
    }
  }

  /**
   * 获取 API Key
   * @returns API Key
   */
  public getApiKey(): string {
    return this.currentConfig.api;
  }

  /**
   * 设置 API Key
   * @param api - API Key
   */
  public setApiKey(api: string): void {
    this.set("api", api);
  }

  /**
   * 获取图像处理配置
   * @returns 图像处理配置
   */
  public getImageProcessingConfig(): ImageProcessOptions {
    return { ...this.currentConfig.imageProcessing };
  }

  /**
   * 设置图像处理配置
   * @param config - 图像处理配置
   */
  public setImageProcessingConfig(config: Partial<ImageProcessOptions>): void {
    this.set("imageProcessing", {
      ...this.currentConfig.imageProcessing,
      ...config,
    });
  }

  /**
   * 获取批量处理配置
   * @returns 批量处理配置
   */
  public getBatchProcessingConfig(): BatchProcessOptions {
    return { ...this.currentConfig.batchProcessing };
  }

  /**
   * 设置批量处理配置
   * @param config - 批量处理配置
   */
  public setBatchProcessingConfig(config: Partial<BatchProcessOptions>): void {
    this.set("batchProcessing", {
      ...this.currentConfig.batchProcessing,
      ...config,
    });
  }

  /**
   * 获取帧提取策略
   * @returns 帧提取策略
   */
  public getFrameExtractionStrategy(): FrameExtractionStrategy {
    return this.currentConfig.frameExtractionStrategy;
  }

  /**
   * 设置帧提取策略
   * @param strategy - 帧提取策略
   */
  public setFrameExtractionStrategy(strategy: FrameExtractionStrategy): void {
    this.set("frameExtractionStrategy", strategy);
  }

  /**
   * 是否启用详细输出和调试模式
   * @returns 是否启用详细输出和调试模式
   */
  public isVerboseMode(): boolean {
    return this.currentConfig.verbose || false;
  }

  /**
   * 设置详细输出和调试模式
   * @param verbose - 是否启用详细输出和调试模式
   */
  public setVerboseMode(verbose: boolean): void {
    this.currentConfig.verbose = verbose;
  }

  /**
   * 获取临时目录
   * @returns 临时目录路径
   */
  public getTempDirectory(): string {
    return this.currentConfig.tempDirectory;
  }

  /**
   * 设置临时目录
   * @param tempDirectory - 临时目录路径
   */
  public setTempDirectory(tempDirectory: string): void {
    this.set("tempDirectory", tempDirectory);
  }

  /**
   * 获取 Prompt 配置
   * @returns Prompt 配置
   */
  public getPromptConfig(): PromptConfig {
    return { ...this.currentConfig.promptConfig };
  }

  /**
   * 设置 Prompt 配置
   * @param config - Prompt 配置
   */
  public setPromptConfig(config: Partial<PromptConfig>): void {
    // 处理清除自定义模板的情况（设置为空字符串或 undefined）
    const updatedConfig = { ...config };
    if (updatedConfig.customTemplate === "") {
      updatedConfig.customTemplate = undefined;
    }

    this.set("promptConfig", {
      ...this.currentConfig.promptConfig,
      ...updatedConfig,
    });
  }

  /**
   * 重置 Prompt 配置到默认值
   */
  public resetPromptConfig(): void {
    this.set("promptConfig", {
      filenameLength: this.getDefaultConfig().promptConfig.filenameLength,
      customTemplate: undefined,
      filenameTemplate: {
        template: undefined,
        dateSource: ["exif", "created", "modified"],
      },
    });
  }

  /**
   * 获取文件名模板配置
   * @returns 文件名模板配置
   */
  public getFilenameTemplateConfig(): FilenameTemplateConfig {
    const promptConfig = this.getPromptConfig();
    const defaultConfig = this.getDefaultConfig();
    return (
      promptConfig.filenameTemplate ||
      defaultConfig.promptConfig.filenameTemplate || {
        template: "",
        dateSource: ["exif", "created", "modified"],
      }
    );
  }

  /**
   * 设置文件名模板配置
   * @param config - 文件名模板配置
   */
  public setFilenameTemplateConfig(
    config: Partial<FilenameTemplateConfig>,
  ): void {
    const currentPromptConfig = this.getPromptConfig();
    const defaultConfig = this.getDefaultConfig();
    const currentTemplateConfig = currentPromptConfig.filenameTemplate ||
      defaultConfig.promptConfig.filenameTemplate || {
        template: "",
        dateSource: ["exif", "created", "modified"],
      };

    this.setPromptConfig({
      ...currentPromptConfig,
      filenameTemplate: {
        ...currentTemplateConfig,
        ...config,
      },
    });
  }

  /**
   * 检查是否启用了文件名模板
   * @returns 是否启用了文件名模板
   */
  public isFilenameTemplateEnabled(): boolean {
    const templateConfig = this.getFilenameTemplateConfig();
    return !!templateConfig.template;
  }
}

/** 全局配置管理器实例 */
let configManager: ConfigManager | null = null;

/**
 * 获取配置管理器实例
 * @returns 配置管理器实例
 */
export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

/**
 * 创建交互式配置设置
 * @param options - 配置选项
 * @returns 配置结果
 */
export async function interactiveConfig(options: {
  /**  */
  api?: string;
  batchSize?: number;
  verbose?: boolean;
  filenameLength?: number;
  customPrompt?: string;
  resetPrompt?: boolean;
  template?: string;
  dateSource?: string;
}) {
  const manager = getConfigManager();

  try {
    // 设置 API Key
    if (options.api) {
      manager.setApiKey(options.api);
    }

    // 设置批量处理大小
    if (options.batchSize && options.batchSize > 0) {
      manager.setBatchProcessingConfig({ batchSize: options.batchSize });
    }

    // 设置详细输出和调试模式
    if (options.verbose !== undefined) {
      manager.setVerboseMode(options.verbose);
    }

    // 重置 Prompt 配置
    if (options.resetPrompt) {
      manager.resetPromptConfig();
    }

    // 设置 Prompt 配置
    if (options.filenameLength !== undefined) {
      manager.setPromptConfig({ filenameLength: options.filenameLength });
    }

    if (options.customPrompt !== undefined) {
      manager.setPromptConfig({ customTemplate: options.customPrompt });
    }

    // 设置文件名模板配置
    if (options.template !== undefined) {
      manager.setFilenameTemplateConfig({ template: options.template });
    }

    if (options.dateSource !== undefined) {
      const sources = options.dateSource.split(",").map((s) => s.trim()) as (
        | "exif"
        | "created"
        | "modified"
      )[];
      const validSources = sources.filter((s) =>
        ["exif", "created", "modified"].includes(s),
      );
      if (validSources.length > 0) {
        manager.setFilenameTemplateConfig({ dateSource: validSources });
      }
    }

    // 验证配置
    const validation = manager.validateConfig();
    if (!validation.valid) {
      console.error("配置验证失败:", validation.errors);
      return false;
    }

    return true;
  } catch (error) {
    console.error("配置设置失败:", error);
    return false;
  }
}

/**
 * 交互式选择帧提取策略
 * @returns 选择的帧提取策略
 */
export async function selectFrameExtractionStrategy(): Promise<FrameExtractionStrategy | null> {
  const manager = getConfigManager();
  const currentConfig = manager.getConfig();

  console.log("\n🎯 帧提取策略选择\n");

  interface StrategyAnswer {
    strategy: FrameExtractionStrategy;
  }

  const answer = await safePrompt<StrategyAnswer>([
    {
      type: "list",
      name: "strategy",
      message: "请选择帧提取策略:",
      choices: [
        {
          name: "单帧提取 (single) - 提取视频中间一帧，速度最快",
          value: "single",
        },
        {
          name: "多帧提取 (multiple) - 提取多个均匀分布的帧，分析更全面",
          value: "multiple",
        },
        {
          name: "关键帧提取 (keyframes) - 提取视频关键帧，质量最高",
          value: "keyframes",
        },
      ],
      default: currentConfig.frameExtractionStrategy,
    },
  ] as unknown as Parameters<typeof inquirer.prompt>[0]);

  return answer?.strategy || null;
}
