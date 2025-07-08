import { existsSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Content } from "@google/genai";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import {
  type AnalysisStats,
  AnalysisStatsCollector,
} from "@/analysis-stats-collector";
import type { FrameSenseOptions } from "@/config";
import { IMAGE_EXTENSIONS } from "@/constants";
import { AI_PROMPTS } from "@/prompts";
import { logger } from "@/utils/logger";

/**
 * AI 分析器
 */
export class AIAnalyzer {
  private genAI: GoogleGenAI;
  private options: FrameSenseOptions;
  private statsCollector: AnalysisStatsCollector;

  constructor(options: FrameSenseOptions) {
    this.options = options;
    this.statsCollector = new AnalysisStatsCollector();

    // 获取 API 密钥
    const apiKey = options.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "API Key 未配置。请设置 GOOGLE_API_KEY 环境变量或在配置文件中指定 apiKey",
      );
    }

    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * 获取统计信息
   */
  getStats(): AnalysisStats {
    return this.statsCollector.getStats();
  }

  /**
   * 分析帧（用于视频）
   * @param framePaths 帧路径
   * @returns 分析结果
   */
  async analyzeFrames(framePaths: string[]): Promise<string> {
    return this.performAnalysis(framePaths, AI_PROMPTS.VIDEO_ANALYSIS, false);
  }

  /**
   * 分析图片（统一多图片处理）
   * @param imagePaths 图片路径数组
   * @returns 分析结果
   */
  async analyzeImage(imagePaths: string[]): Promise<string> {
    // 验证图片数量限制
    if (imagePaths.length > 3600) {
      throw new Error("批量处理最多支持3600张图片");
    }

    if (imagePaths.length === 0) {
      throw new Error("图片路径不能为空");
    }

    // 验证所有图片文件是否存在
    const missingFiles = imagePaths.filter((path) => !existsSync(path));
    if (missingFiles.length > 0) {
      throw new Error(`以下图片文件不存在: ${missingFiles.join(", ")}`);
    }

    // 过滤不支持的图片格式
    const unsupportedFiles = imagePaths.filter((path) => {
      const ext = path.toLowerCase().split(".").pop() || "";
      return !(IMAGE_EXTENSIONS as readonly string[]).includes(ext);
    });

    if (unsupportedFiles.length > 0) {
      throw new Error(`不支持的图片格式: ${unsupportedFiles.join(", ")}`);
    }

    return this.performAnalysis(imagePaths, AI_PROMPTS.IMAGE_ANALYSIS, true);
  }

  /**
   * 测试 API 连接
   * @returns 测试结果
   */
  async testConnection(): Promise<string> {
    try {
      const result = await this.genAI.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "请简短回复'连接成功'来确认API工作正常。",
              },
            ],
          },
        ],
      });

      return result.text?.trim() || "API 响应为空";
    } catch (error) {
      throw new Error(
        `API 连接测试失败: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * 执行 AI 分析的核心逻辑
   * @param imagePaths 图片路径数组
   * @param promptText 提示词
   * @param parseMultipleResults 是否解析多个结果
   * @returns 分析结果
   */
  private async performAnalysis(
    imagePaths: string[],
    promptText: string,
    parseMultipleResults: boolean,
  ): Promise<string> {
    try {
      // 重置统计收集器
      this.statsCollector.reset();

      // 收集文件统计信息
      this.statsCollector.collectFileStats(imagePaths);

      if (this.options.verbose) {
        logger.verbose(`🤖 开始 AI 分析，共 ${imagePaths.length} 个文件`);
        logger.verbose(
          `📊 文件统计: ${imagePaths.length} 个，总大小 ${this.statsCollector.getStats().totalSize > 0 ? `${(this.statsCollector.getStats().totalSize / 1024 / 1024).toFixed(2)} MB` : "0 B"}`,
        );
        logger.verbose(`📝 使用的提示词:`);
        logger.verbose(`---`);
        logger.verbose(promptText);
        logger.verbose(`---`);
      }

      // 优化图片并转换为 base64
      const images: {
        inlineData: {
          data: string;
          mimeType: string;
        };
      }[] = [];

      const optimizedBuffers: Buffer[] = [];

      for (const path of imagePaths) {
        if (this.options.verbose) {
          logger.verbose(`🖼️  正在优化: ${path}`);
        }
        const optimizedBuffer = await this.optimizeImage(path);
        optimizedBuffers.push(optimizedBuffer);

        images.push({
          inlineData: {
            data: optimizedBuffer.toString("base64"),
            mimeType: "image/jpeg",
          },
        });
      }

      const base64Data = images.map((img) => img.inlineData.data);

      // 收集数据统计信息
      this.statsCollector.updateOptimizedSize(optimizedBuffers);
      this.statsCollector.collectDataStats(base64Data, promptText);
      this.statsCollector.estimateTokens(base64Data, promptText);

      if (this.options.verbose) {
        logger.verbose(`📊 完整统计信息:`);
        logger.verbose(this.statsCollector.getFormattedStats());
        logger.verbose(
          `🚀 发送请求到 ${this.options.model || "gemini-2.5-flash"} 模型`,
        );
      }

      // 构建请求内容
      const contents = [
        { parts: [{ text: promptText }], role: "user" },
        ...images.map((img) => ({
          parts: [{ inlineData: img.inlineData }],
          role: "user",
        })),
      ];

      if (this.options.verbose) {
        logger.verbose(`📋 请求结构:`);
        logger.verbose(`  - 文本部分: 1 个 (提示词)`);
        logger.verbose(`  - 图片部分: ${images.length} 个`);
        logger.verbose(`  - 总计内容块: ${contents.length} 个`);

        // 将完整请求内容写入文件
        this.writeRequestToFile(contents);
      }

      // 发送请求
      const result = await this.genAI.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents,
      });

      const responseText = result.text || "";

      if (this.options.verbose) {
        logger.verbose(`✅ AI 分析完成，响应长度: ${responseText.length} 字符`);
        logger.verbose(`📄 AI 响应内容:`);
        logger.verbose(`---`);
        logger.verbose(responseText);
        logger.verbose(`---`);
      }

      // 如果需要解析多个结果（图片分析）
      if (parseMultipleResults) {
        return this.parseMultipleResults(responseText, imagePaths.length);
      }

      return responseText.trim();
    } catch (error) {
      // 详细的错误信息处理
      this.handleAIError(error, imagePaths);
      throw error;
    }
  }

  /**
   * 解析多个结果（用于图片批量分析）
   * @param responseText 响应文本
   * @param expectedCount 期望的结果数量
   * @returns 解析后的结果
   */
  private parseMultipleResults(
    responseText: string,
    expectedCount: number,
  ): string {
    try {
      // 使用正则表达式提取 DESC 格式的描述
      const descMatches = responseText.match(/DESC\d+:\s*(.+?)(?=\n|$)/g);
      if (descMatches && descMatches.length > 0) {
        const descriptions = descMatches.map((match) =>
          match.replace(/^DESC\d+:\s*/, "").trim(),
        );

        logger.verbose(
          `📊 描述数量: ${descriptions.length}, 图片数量: ${expectedCount}`,
        );

        if (this.options.verbose) {
          logger.verbose(`🔍 解析到的描述:`);
          descriptions.forEach((desc, index) => {
            logger.verbose(`  ${index + 1}. ${desc}`);
          });
        }

        if (descriptions.length === expectedCount) {
          return descriptions.join("|||");
        }

        if (descriptions.length > 0) {
          logger.warn("⚠️ 描述数量不匹配，尝试调整...");

          // 调整描述数量
          while (descriptions.length < expectedCount) {
            descriptions.push(
              descriptions[descriptions.length - 1] || "未知内容",
            );
          }

          if (descriptions.length > expectedCount) {
            descriptions.splice(expectedCount);
          }

          if (this.options.verbose) {
            logger.verbose(`🔧 调整后的描述:`);
            descriptions.forEach((desc, index) => {
              logger.verbose(`  ${index + 1}. ${desc}`);
            });
          }

          return descriptions.join("|||");
        }
      }

      // 尝试按行分割
      const lines = responseText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length >= expectedCount) {
        return lines.slice(0, expectedCount).join("|||");
      }
    } catch (_error) {
      logger.warn("解析 AI 批量响应失败，使用统一描述");
    }

    return responseText;
  }

  /**
   * 优化图片 - 根据尺寸和文件大小决定是否压缩
   * @param imagePath 图片路径
   * @returns 优化后的图片缓冲区
   */
  private async optimizeImage(imagePath: string): Promise<Buffer> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // 获取真实文件大小（字节）
    const fileStats = statSync(imagePath);
    const fileSize = fileStats.size;

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // 文件大小超过 500KB 或尺寸超过 1920x720 时才压缩
    const shouldOptimize =
      fileSize > 500 * 1024 || width > 1920 || height > 720;

    if (this.options.verbose) {
      logger.verbose(`  📐 图片尺寸: ${width}x${height}`);
      logger.verbose(`  📏 文件大小: ${(fileSize / 1024).toFixed(2)} KB`);
    }

    if (shouldOptimize) {
      // 计算缩放后的尺寸，保持宽高比
      const aspectRatio = width / height;
      let targetWidth = width;
      let targetHeight = height;

      // 如果宽度超过1920，按宽度缩放
      if (width > 1920) {
        targetWidth = 1920;
        targetHeight = Math.round(1920 / aspectRatio);
      }

      // 如果高度仍然超过720，按高度缩放
      if (targetHeight > 720) {
        targetHeight = 720;
        targetWidth = Math.round(720 * aspectRatio);
      }

      if (this.options.verbose) {
        logger.verbose(
          `  🔧 需要优化: 压缩到 ${targetWidth}x${targetHeight}, 质量 75%`,
        );
      }

      return image
        .resize(targetWidth, targetHeight, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75 })
        .toBuffer();
    }

    if (this.options.verbose) {
      logger.verbose(`  ✅ 无需优化: 直接转换为 JPEG`);
    }
    // 不需要优化，直接转换为 JPEG
    return image.jpeg().toBuffer();
  }

  /**
   * 将请求内容写入文件以便检查
   */
  private writeRequestToFile(rawContents: Content[]): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `ai-request-${timestamp}.json`;
      const filepath = join(tmpdir(), filename);

      const contents = rawContents.map((item, index) => {
        return {
          index,
          role: item.role,
          parts: item.parts?.map((part) => {
            if (part.text) {
              return {
                type: "text",
                content: part.text,
                size: Buffer.byteLength(part.text, "utf8"),
              };
            }
            if (part.inlineData) {
              const base64Length = part.inlineData.data?.length || 0;
              const actualDataSize = Math.floor(base64Length * 0.75);
              return {
                type: "image",
                mimeType: part.inlineData.mimeType,
                base64Size: base64Length,
                actualDataSize,
                dataSample: `${part.inlineData.data?.substring(0, 100)}...`,
              };
            }
            return part;
          }),
        };
      });

      writeFileSync(filepath, JSON.stringify(contents, null, 2));
      logger.debug(`📄 请求内容已保存到: ${filepath}`);
    } catch (error) {
      if (this.options.verbose) {
        logger.warn(
          `⚠️ 无法保存请求文件: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  /**
   * 处理 AI 错误信息
   */
  private handleAIError(error: unknown, imagePaths: string[]): void {
    if (this.options.verbose) {
      logger.error(`❌ AI 分析失败，错误详情:`);

      if (error instanceof Error) {
        logger.error(`  类型: ${error.constructor.name}`);
        logger.error(`  消息: ${error.message}`);
        if (error.stack) {
          logger.error(`  堆栈:`);
          logger.debug(error.stack);
        }
      } else {
        logger.error(`  未知错误: ${JSON.stringify(error, null, 2)}`);
      }

      logger.error(`  相关文件: ${imagePaths.length} 个`);
      imagePaths.forEach((path, index) => {
        logger.debug(`    ${index + 1}. ${path}`);
      });

      logger.error(`  统计信息:`);
      logger.debug(this.statsCollector.getDebugInfo());
    }
  }
}
