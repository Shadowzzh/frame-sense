import { existsSync, statSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import type { FrameSenseOptions } from "@/config";
import { IMAGE_EXTENSIONS } from "@/constants";
import { AI_PROMPTS } from "@/prompts";

/**
 * 统计信息接口
 * 用于记录分析过程中的统计信息
 */
export interface AnalysisStats {
  /** 文件总数 */
  totalFiles: number;
  /** 文件总大小（字节） */
  totalSize: number;
  /** 预估 token 数 */
  estimatedTokens: number;
  /** 发送数据大小（字节） */
  sentDataSize: number;
}

/**
 * AI 分析器
 */
export class AIAnalyzer {
  private genAI: GoogleGenAI;
  private options: FrameSenseOptions;
  private stats: AnalysisStats = {
    totalFiles: 0,
    totalSize: 0,
    estimatedTokens: 0,
    sentDataSize: 0,
  };

  constructor(options: FrameSenseOptions) {
    this.options = options;

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
    return { ...this.stats };
  }

  /**
   * 计算文件统计信息
   * @param filePaths 文件路径数组
   */
  private calculateFileStats(filePaths: string[]): void {
    let totalSize = 0;

    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        const stats = statSync(filePath);
        totalSize += stats.size;
      }
    }

    this.stats.totalFiles = filePaths.length;
    this.stats.totalSize = totalSize;
  }

  /**
   * 估算 token 数量
   * @param base64Data base64 编码的数据
   * @param text 文本内容
   */
  private estimateTokens(base64Data: string[], text: string): number {
    // 文本 token 估算 (1 token ≈ 4 字符)
    const textTokens = Math.ceil(text.length / 4);

    // 图片 token 估算 (每张图片大约 258 tokens)
    const imageTokens = base64Data.length * 258;

    return textTokens + imageTokens;
  }

  /**
   * 计算发送数据大小
   * @param base64Data base64 编码的数据数组
   * @param text 文本内容
   */
  private calculateSentDataSize(base64Data: string[], text: string): number {
    // 文本大小 (UTF-8 编码)
    const textSize = Buffer.byteLength(text, "utf8");

    // base64 数据大小
    const base64Size = base64Data.reduce(
      (total, data) => total + data.length,
      0,
    );

    return textSize + base64Size;
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
      // 计算文件统计信息
      this.calculateFileStats(imagePaths);

      // 优化图片并转换为 base64
      const images = await Promise.all(
        imagePaths.map(async (path) => {
          const optimizedBuffer = await this.optimizeImage(path);
          return {
            inlineData: {
              data: optimizedBuffer.toString("base64"),
              mimeType: "image/jpeg",
            },
          };
        }),
      );

      const base64Data = images.map((img) => img.inlineData.data);

      // 计算统计信息
      this.stats.estimatedTokens = this.estimateTokens(base64Data, promptText);
      this.stats.sentDataSize = this.calculateSentDataSize(
        base64Data,
        promptText,
      );

      // 构建请求内容
      const contents = [
        { parts: [{ text: promptText }], role: "user" },
        ...images.map((img) => ({
          parts: [{ inlineData: img.inlineData }],
          role: "user",
        })),
      ];

      // 发送请求
      const result = await this.genAI.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents,
      });

      const responseText = result.text || "";

      // 如果需要解析多个结果（图片分析）
      if (parseMultipleResults) {
        return this.parseMultipleResults(responseText, imagePaths.length);
      }

      return responseText.trim();
    } catch (error) {
      throw new Error(
        `AI 分析失败: ${error instanceof Error ? error.message : error}`,
      );
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

        console.log(
          `📊 描述数量: ${descriptions.length}, 图片数量: ${expectedCount}`,
        );

        if (descriptions.length === expectedCount) {
          return descriptions.join("|||");
        }

        if (descriptions.length > 0) {
          console.log("⚠️ 描述数量不匹配，尝试调整...");

          // 调整描述数量
          while (descriptions.length < expectedCount) {
            descriptions.push(
              descriptions[descriptions.length - 1] || "未知内容",
            );
          }

          if (descriptions.length > expectedCount) {
            descriptions.splice(expectedCount);
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
      console.warn("解析 AI 批量响应失败，使用统一描述");
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

    // 获取文件大小（字节）
    const fileSize = metadata.size || 0;
    // 文件大小超过 2MB 或尺寸超过 1920x1080 时才压缩
    const shouldOptimize =
      fileSize > 2 * 1024 * 1024 ||
      (metadata.width && metadata.width > 1920) ||
      (metadata.height && metadata.height > 1080);

    if (shouldOptimize) {
      return image
        .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
    }

    // 不需要优化，直接转换为 JPEG
    return image.jpeg().toBuffer();
  }
}
