import { existsSync, readFileSync } from "node:fs";
import Conf from "conf";

/** 图片优化选项 */
export interface ImageOptimizeOptions {
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 质量 (1-100) */
  quality: number;
}

/** 配置选项 */
export interface FrameSenseOptions {
  /** 目录 */
  directory?: string;
  /** 文件 */
  files?: string[];
  /** 帧数 */
  frames: number;
  /** 格式 semantic 语义化 structured 结构化 */
  format: "semantic" | "structured";
  /** 是否预览 */
  dryRun: boolean;
  /** 是否详细 */
  verbose: boolean;
  /** API 密钥 */
  apiKey?: string;
  /** 模型 */
  model?: string;
  /** 图片优化设置 */
  imageOptimize?: ImageOptimizeOptions;
}

/** 配置类 */
export class FrameSenseConfig {
  /** 配置 */
  private conf: Conf<FrameSenseOptions>;
  /** 自定义配置路径 */
  private customConfigPath?: string;

  /**
   * 构造函数
   * @param customConfigPath 自定义配置路径
   */
  constructor(customConfigPath?: string) {
    this.customConfigPath = customConfigPath;

    // 如果提供了自定义配置文件路径，验证其存在性
    if (customConfigPath && !existsSync(customConfigPath)) {
      throw new Error(`配置文件不存在: ${customConfigPath}`);
    }

    this.conf = new Conf<FrameSenseOptions>({
      projectName: "frame-sense",
      // 默认配置
      defaults: {
        frames: 2,
        format: "semantic",
        dryRun: false,
        verbose: false,
        model: "gemini-2.5-flash",
        imageOptimize: {
          width: 1280,
          height: 720,
          quality: 75,
        },
      },
      configFileMode: 0o600, // 仅所有者可读写
    });
  }

  /**
   * 获取配置
   * @returns 配置
   */
  getConfig(): FrameSenseOptions {
    // 如果有自定义配置文件，尝试加载
    if (this.customConfigPath) {
      try {
        const customConfig = JSON.parse(
          readFileSync(this.customConfigPath, "utf-8"),
        );
        return { ...this.conf.store, ...customConfig };
      } catch {
        throw new Error(`无法解析配置文件: ${this.customConfigPath}`);
      }
    }

    return this.conf.store;
  }

  /**
   * 设置配置
   * @param key 配置键
   * @param value 配置值
   */
  setConfig(key: keyof FrameSenseOptions, value: unknown) {
    this.conf.set(key, value);
  }

  /**
   * 获取配置路径
   * @returns 配置路径
   */
  getConfigPath(): string {
    return this.conf.path;
  }

  /**
   * 重置配置
   */
  resetConfig() {
    this.conf.clear();
  }
}
