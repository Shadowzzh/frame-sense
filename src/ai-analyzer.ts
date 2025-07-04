import { existsSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import type { FrameSenseOptions } from "./config.js";
import { IMAGE_EXTENSIONS } from "./constants.js";
import { AI_PROMPTS } from "./prompts.js";

/**
 * AI 分析器
 */
export class AIAnalyzer {
  private genAI: GoogleGenAI;
  private options: FrameSenseOptions;

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
   * 分析帧（用于视频）
   * @param framePaths 帧路径
   * @returns 分析结果
   */
  async analyzeFrames(framePaths: string[]): Promise<string> {
    try {
      const images = await Promise.all(
        framePaths.map(async (path) => {
          const optimizedBuffer = await this.optimizeImage(path);
          return {
            inlineData: {
              data: optimizedBuffer.toString("base64"),
              mimeType: "image/jpeg",
            },
          };
        }),
      );

      const contents = [
        {
          parts: [{ text: AI_PROMPTS.VIDEO_ANALYSIS }],
          role: "user",
        },
        ...images.map((img) => ({
          parts: [{ inlineData: img.inlineData }],
          role: "user",
        })),
      ];

      const result = await this.genAI.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents,
      });

      return result.text?.trim() || "";
    } catch (error) {
      throw new Error(
        `AI 分析失败: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * 分析图片（统一多图片处理）
   * @param imagePaths 图片路径数组
   * @returns 分析结果
   *
   * 特性：
   * - 最多支持3600张图片
   * - 支持格式：jpg, jpeg, png, gif, bmp, webp, tiff, heic, heif
   * - 单张图片也放在数组中进行处理
   */
  async analyzeImage(imagePaths: string[]): Promise<string> {
    try {
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

      // 如果存在不支持的图片格式，则抛出错误
      if (unsupportedFiles.length > 0) {
        throw new Error(`不支持的图片格式: ${unsupportedFiles.join(", ")}`);
      }

      // 使用 Sharp 优化图片并转换为 base64 格式
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

      const contents = [
        {
          parts: [{ text: AI_PROMPTS.IMAGE_ANALYSIS }],
          role: "user",
        },
        ...images.map((img) => ({
          parts: [{ inlineData: img.inlineData }],
          role: "user",
        })),
      ];

      const result = await this.genAI.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents,
      });

      const responseText = result.text || "";

      // 解析响应格式
      try {
        // 使用正则表达式提取所有 DESC 格式的描述
        const descMatches = responseText.match(/DESC\d+:\s*(.+?)(?=\n|$)/g);
        if (descMatches && descMatches.length > 0) {
          // 提取每个描述的内容（去掉 DESC数字: 前缀）
          const descriptions = descMatches.map((match) =>
            match.replace(/^DESC\d+:\s*/, "").trim(),
          );

          // 验证描述数量是否与图片数量匹配
          if (descriptions.length === imagePaths.length) {
            return descriptions.join("|||"); // 使用特殊分隔符连接
          }
        }

        // 如果没有找到 DESC 格式，尝试按行分割
        const lines = responseText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length >= imagePaths.length) {
          return lines.slice(0, imagePaths.length).join("|||");
        }
      } catch (_error) {
        // 解析失败，回退到统一描述
        console.warn("解析 AI 批量响应失败，使用统一描述");
      }

      return responseText;
    } catch (error) {
      throw new Error(
        `AI 分析失败: ${error instanceof Error ? error.message : error}`,
      );
    }
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
