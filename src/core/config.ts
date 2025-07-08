/**
 * 配置管理系统
 * 提供多层配置支持：命令行参数、配置文件、环境变量
 */

import { homedir } from "node:os";
import { join } from "node:path";
import Conf from "conf";
import type {
  AppConfig,
  BatchProcessOptions,
  FrameExtractionStrategy,
  ImageProcessOptions,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";

export class ConfigManager {
  /** 配置存储实例 */
  private conf: Conf<AppConfig>;
  /** 当前配置 */
  private currentConfig: AppConfig;

  constructor() {
    // 初始化配置存储
    this.conf = new Conf<AppConfig>({
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
      apiKey: "",
      apiBaseUrl: "https://generativelanguage.googleapis.com",
      defaultModel: "gemini-1.5-flash",
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
      frameExtractionStrategy: "single",
      tempDirectory: FileUtils.getTempDir(),
      debug: false,
      verbose: false,
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
      config.apiKey = process.env.FRAME_SENSE_API_KEY;
    }

    if (process.env.FRAME_SENSE_API_BASE_URL) {
      config.apiBaseUrl = process.env.FRAME_SENSE_API_BASE_URL;
    }

    if (process.env.FRAME_SENSE_MODEL) {
      config.defaultModel = process.env.FRAME_SENSE_MODEL;
    }

    if (process.env.FRAME_SENSE_BATCH_SIZE) {
      const batchSize = parseInt(process.env.FRAME_SENSE_BATCH_SIZE, 10);
      if (!isNaN(batchSize) && batchSize > 0) {
        config.batchProcessing.batchSize = batchSize;
      }
    }

    if (process.env.FRAME_SENSE_DEBUG === "true") {
      config.debug = true;
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
    if (!this.currentConfig.apiKey || this.currentConfig.apiKey.trim() === "") {
      errors.push("API Key 未配置");
    }

    // 检查 API Base URL
    if (
      !this.currentConfig.apiBaseUrl ||
      this.currentConfig.apiBaseUrl.trim() === ""
    ) {
      errors.push("API Base URL 未配置");
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
      const fs = require("fs");
      fs.writeFileSync(filePath, configJson, "utf8");

      return true;
    } catch (error) {
      console.error("导出配置失败:", error);
      return false;
    }
  }

  /**
   * 从文件导入配置
   * @param filePath - 导入文件路径
   * @returns 是否成功
   */
  public importConfig(filePath: string): boolean {
    try {
      if (!FileUtils.fileExists(filePath)) {
        return false;
      }

      const fs = require("fs");
      const configJson = fs.readFileSync(filePath, "utf8");
      const config = JSON.parse(configJson) as Partial<AppConfig>;

      // 验证配置
      const tempConfig = { ...this.getDefaultConfig(), ...config };
      const validation = this.validateConfig();

      if (!validation.valid) {
        console.error("配置验证失败:", validation.errors);
        return false;
      }

      this.setConfig(config);
      return true;
    } catch (error) {
      console.error("导入配置失败:", error);
      return false;
    }
  }

  /**
   * 获取 API Key
   * @returns API Key
   */
  public getApiKey(): string {
    return this.currentConfig.apiKey;
  }

  /**
   * 设置 API Key
   * @param apiKey - API Key
   */
  public setApiKey(apiKey: string): void {
    this.set("apiKey", apiKey);
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
   * 是否启用调试模式
   * @returns 是否启用调试模式
   */
  public isDebugMode(): boolean {
    return this.currentConfig.debug;
  }

  /**
   * 设置调试模式
   * @param debug - 是否启用调试模式
   */
  public setDebugMode(debug: boolean): void {
    this.set("debug", debug);
  }

  /**
   * 是否启用详细输出
   * @returns 是否启用详细输出
   */
  public isVerboseMode(): boolean {
    return this.currentConfig.verbose;
  }

  /**
   * 设置详细输出模式
   * @param verbose - 是否启用详细输出
   */
  public setVerboseMode(verbose: boolean): void {
    this.set("verbose", verbose);
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
  apiKey?: string;
  batchSize?: number;
  debug?: boolean;
  verbose?: boolean;
}): Promise<boolean> {
  const manager = getConfigManager();

  try {
    // 设置 API Key
    if (options.apiKey) {
      manager.setApiKey(options.apiKey);
    }

    // 设置批量处理大小
    if (options.batchSize && options.batchSize > 0) {
      manager.setBatchProcessingConfig({ batchSize: options.batchSize });
    }

    // 设置调试模式
    if (options.debug !== undefined) {
      manager.setDebugMode(options.debug);
    }

    // 设置详细输出
    if (options.verbose !== undefined) {
      manager.setVerboseMode(options.verbose);
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
