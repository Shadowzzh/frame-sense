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
import { AI_ANALYZER_CONFIG, IMAGE_EXTENSIONS } from "@/constants";
import { AI_PROMPTS } from "@/prompts";
import type { AnalysisRequest, ImageData } from "@/types";
import { logger } from "@/utils/logger";

/**
 * AI 分析器
 */
export class AIAnalyzer {
  private genAI: GoogleGenAI;
  private options: FrameSenseOptions;
  private statsCollector: AnalysisStatsCollector;
  private verboseBuffer: string[] = [];
  private isSpinnerMode: boolean = false;

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
   * 分析图片（统一多图片处理）
   */
  async analyzeImage(imagePaths: string[]): Promise<string> {
    this.validateImagePaths(imagePaths);

    // 检查是否需要在这里启用 spinner 模式
    const shouldEnableSpinner = !this.isSpinnerMode;
    if (shouldEnableSpinner) {
      this.enableSpinnerMode();
    }

    try {
      const result = await this.performAnalysis({
        imagePaths,
        promptText: AI_PROMPTS.IMAGE_ANALYSIS,
        parseMultipleResults: true,
      });

      return result;
    } finally {
      // 如果是在这里启用的 spinner 模式，需要在这里禁用
      if (shouldEnableSpinner) {
        this.disableSpinnerMode();
      }
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<string> {
    try {
      const result = await this.genAI.models.generateContent({
        model: this.options.model || AI_ANALYZER_CONFIG.DEFAULT_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: "请简短回复'连接成功'来确认API工作正常。" }],
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
   */
  private async performAnalysis(request: AnalysisRequest): Promise<string> {
    try {
      this.prepareAnalysis(request.imagePaths, request.promptText);
      const images = await this.processImages(request.imagePaths);
      const response = await this.sendAnalysisRequest(
        images,
        request.promptText,
      );

      const result = this.handleAnalysisResponse(
        response,
        request.parseMultipleResults,
        request.imagePaths.length,
      );

      return result;
    } catch (error) {
      this.handleAIError(error, request.imagePaths);
      throw error;
    }
  }

  /**
   * 验证图片路径
   */
  private validateImagePaths(imagePaths: string[]): void {
    if (imagePaths.length > AI_ANALYZER_CONFIG.MAX_BATCH_SIZE) {
      throw new Error(
        `批量处理最多支持${AI_ANALYZER_CONFIG.MAX_BATCH_SIZE}张图片`,
      );
    }
    if (imagePaths.length === 0) {
      throw new Error("图片路径不能为空");
    }

    const missingFiles = imagePaths.filter((path) => !existsSync(path));
    if (missingFiles.length > 0) {
      throw new Error(`以下图片文件不存在: ${missingFiles.join(", ")}`);
    }

    const unsupportedFiles = imagePaths.filter((path) => {
      const ext = path.toLowerCase().split(".").pop() || "";
      return !(IMAGE_EXTENSIONS as readonly string[]).includes(ext);
    });
    if (unsupportedFiles.length > 0) {
      throw new Error(`不支持的图片格式: ${unsupportedFiles.join(", ")}`);
    }
  }

  /**
   * 准备分析
   */
  private prepareAnalysis(imagePaths: string[], promptText: string): void {
    this.statsCollector.reset();
    this.statsCollector.collectFileStats(imagePaths);
    this.logAnalysisStart(imagePaths, promptText);
  }

  /**
   * 处理图片
   */
  private async processImages(imagePaths: string[]): Promise<ImageData[]> {
    const images: ImageData[] = [];
    const optimizedBuffers: Buffer[] = [];

    for (const path of imagePaths) {
      this.logVerbose(`🖼️  正在优化: ${path}`);
      const optimizedBuffer = await this.optimizeImage(path);
      optimizedBuffers.push(optimizedBuffer);

      images.push({
        inlineData: {
          data: optimizedBuffer.toString("base64"),
          mimeType: "image/jpeg",
        },
      });
    }

    this.updateAnalysisStats(images, optimizedBuffers);
    return images;
  }

  /**
   * 发送分析请求
   */
  private async sendAnalysisRequest(
    images: ImageData[],
    promptText: string,
  ): Promise<string> {
    const contents = [
      { parts: [{ text: promptText }], role: "user" },
      ...images.map((img) => ({
        parts: [{ inlineData: img.inlineData }],
        role: "user",
      })),
    ];

    this.logRequestDetails(contents, images.length);

    const result = await this.genAI.models.generateContent({
      model: this.options.model || AI_ANALYZER_CONFIG.DEFAULT_MODEL,
      contents,
    });

    return result.text || "";
  }

  /**
   * 处理分析响应
   */
  private handleAnalysisResponse(
    responseText: string,
    parseMultipleResults: boolean,
    expectedCount: number,
  ): string {
    this.logVerbose(`✅ AI 分析完成，响应长度: ${responseText.length} 字符`);
    this.logVerbose(`📄 AI 响应内容:\n---\n${responseText}\n---`);

    return parseMultipleResults
      ? this.parseMultipleResults(responseText, expectedCount)
      : responseText.trim();
  }

  /**
   * 解析多个结果（用于图片批量分析）
   */
  private parseMultipleResults(
    responseText: string,
    expectedCount: number,
  ): string {
    const descMatches = responseText.match(/DESC\d+:\s*(.+?)(?=\n|$)/g);
    if (descMatches && descMatches.length > 0) {
      const descriptions = descMatches.map((match) =>
        match.replace(/^DESC\d+:\s*/, "").trim(),
      );

      this.logVerbose(
        `📊 描述数量: ${descriptions.length}, 图片数量: ${expectedCount}`,
      );
      this.logDescriptions(descriptions);

      if (descriptions.length === expectedCount) {
        return descriptions.join("|||");
      }

      if (descriptions.length > 0) {
        return this.adjustDescriptions(descriptions, expectedCount);
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

    return responseText;
  }

  /**
   * 优化图片 - 根据尺寸和文件大小决定是否压缩
   */
  private async optimizeImage(imagePath: string): Promise<Buffer> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const fileStats = statSync(imagePath);
    const fileSize = fileStats.size;
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const shouldOptimize =
      fileSize > AI_ANALYZER_CONFIG.IMAGE_SIZE_THRESHOLD ||
      width > AI_ANALYZER_CONFIG.IMAGE_MAX_WIDTH ||
      height > AI_ANALYZER_CONFIG.IMAGE_MAX_HEIGHT;

    this.logVerbose(`  📐 图片尺寸: ${width}x${height}`);
    this.logVerbose(`  📏 文件大小: ${(fileSize / 1024).toFixed(2)} KB`);

    if (shouldOptimize) {
      const { targetWidth, targetHeight } = this.calculateTargetSize(
        width,
        height,
      );
      this.logVerbose(
        `  🔧 需要优化: 压缩到 ${targetWidth}x${targetHeight}, 质量 ${AI_ANALYZER_CONFIG.IMAGE_QUALITY}%`,
      );

      return image
        .resize(targetWidth, targetHeight, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: AI_ANALYZER_CONFIG.IMAGE_QUALITY })
        .toBuffer();
    }

    this.logVerbose(`  ✅ 无需优化: 直接转换为 JPEG`);
    return image.jpeg().toBuffer();
  }

  /**
   * 计算目标尺寸
   */
  private calculateTargetSize(
    width: number,
    height: number,
  ): { targetWidth: number; targetHeight: number } {
    const aspectRatio = width / height;
    let targetWidth = width;
    let targetHeight = height;

    if (width > AI_ANALYZER_CONFIG.IMAGE_MAX_WIDTH) {
      targetWidth = AI_ANALYZER_CONFIG.IMAGE_MAX_WIDTH;
      targetHeight = Math.round(
        AI_ANALYZER_CONFIG.IMAGE_MAX_WIDTH / aspectRatio,
      );
    }

    if (targetHeight > AI_ANALYZER_CONFIG.IMAGE_MAX_HEIGHT) {
      targetHeight = AI_ANALYZER_CONFIG.IMAGE_MAX_HEIGHT;
      targetWidth = Math.round(
        AI_ANALYZER_CONFIG.IMAGE_MAX_HEIGHT * aspectRatio,
      );
    }

    return { targetWidth, targetHeight };
  }

  /**
   * 日志辅助方法
   */
  private logVerbose(message: string): void {
    if (this.options.verbose) {
      if (this.isSpinnerMode) {
        // 在 spinner 模式下缓存日志
        this.verboseBuffer.push(message);
      } else {
        logger.verbose(message);
      }
    }
  }

  /**
   * 启用 spinner 模式
   */
  enableSpinnerMode(): void {
    this.isSpinnerMode = true;
    this.verboseBuffer = [];
  }

  /**
   * 禁用 spinner 模式并输出缓存的日志
   */
  disableSpinnerMode(): void {
    this.isSpinnerMode = false;
    if (this.verboseBuffer.length > 0) {
      this.verboseBuffer.forEach((msg) => logger.verbose(msg));
      this.verboseBuffer = [];
    }
  }

  private logAnalysisStart(imagePaths: string[], promptText: string): void {
    this.logVerbose(`🤖 开始 AI 分析，共 ${imagePaths.length} 个文件`);
    const stats = this.statsCollector.getStats();
    const sizeText =
      stats.totalSize > 0
        ? `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`
        : "0 B";
    this.logVerbose(`📊 文件统计: ${imagePaths.length} 个，总大小 ${sizeText}`);
    this.logVerbose(`📝 使用的提示词:\n---\n${promptText}\n---`);
  }

  private updateAnalysisStats(
    images: ImageData[],
    optimizedBuffers: Buffer[],
  ): void {
    const base64Data = images.map((img) => img.inlineData.data);
    this.statsCollector.updateOptimizedSize(optimizedBuffers);
    this.statsCollector.collectDataStats(base64Data, "");
    this.statsCollector.estimateTokens(base64Data, "");
    this.logVerbose(
      `📊 完整统计信息:\n${this.statsCollector.getFormattedStats()}`,
    );
  }

  private logRequestDetails(contents: Content[], imageCount: number): void {
    this.logVerbose(
      `🚀 发送请求到 ${this.options.model || AI_ANALYZER_CONFIG.DEFAULT_MODEL} 模型`,
    );
    this.logVerbose(
      `📋 请求结构:\n  - 文本部分: 1 个 (提示词)\n  - 图片部分: ${imageCount} 个\n  - 总计内容块: ${contents.length} 个`,
    );
    if (this.options.verbose) {
      this.writeRequestToFile(contents);
    }
  }

  private logDescriptions(descriptions: string[]): void {
    if (this.options.verbose) {
      this.logVerbose(`🔍 解析到的描述:`);
      descriptions.forEach((desc, index) => {
        this.logVerbose(`  ${index + 1}. ${desc}`);
      });
    }
  }

  private adjustDescriptions(
    descriptions: string[],
    expectedCount: number,
  ): string {
    logger.warn("⚠️ 描述数量不匹配，尝试调整...");

    while (descriptions.length < expectedCount) {
      descriptions.push(descriptions[descriptions.length - 1] || "未知内容");
    }

    if (descriptions.length > expectedCount) {
      descriptions.splice(expectedCount);
    }

    this.logDescriptions(descriptions);
    return descriptions.join("|||");
  }

  /**
   * 将请求内容写入文件以便检查
   */
  private writeRequestToFile(rawContents: Content[]): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `ai-request-${timestamp}.json`;
      const filepath = join(tmpdir(), filename);

      const contents = rawContents.map((item, index) => ({
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
            return {
              type: "image",
              mimeType: part.inlineData.mimeType,
              base64Size: base64Length,
              actualDataSize: Math.floor(base64Length * 0.75),
              dataSample: `${part.inlineData.data?.substring(0, 100)}...`,
            };
          }
          return part;
        }),
      }));

      writeFileSync(filepath, JSON.stringify(contents, null, 2));
      this.logVerbose(`📄 请求内容已保存到: ${filepath}`);
    } catch (error) {
      this.logVerbose(
        `⚠️ 无法保存请求文件: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * 处理 AI 错误信息
   */
  private handleAIError(error: unknown, imagePaths: string[]): void {
    if (!this.options.verbose) return;

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
