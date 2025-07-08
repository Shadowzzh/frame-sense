/**
 * AI 分析器
 * 使用 Google Gemini API 进行图像内容分析，支持批量处理和智能优化
 */

import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { getConfigManager } from "@/core/config";
import { ImageProcessor } from "@/core/image-processor";
import type {
  AnalysisRequest,
  AnalysisResult,
  BatchProcessingStats,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";

export class AIAnalyzer {
  /** Google Generative AI 实例 */
  private genAI: GoogleGenAI;
  /** 图像处理器实例 */
  private imageProcessor: ImageProcessor;
  /** 默认提示词 */
  private static readonly DEFAULT_PROMPT = `
请分析这些图像的内容，并为每个图像生成一个简洁、描述性的文件名。

要求：
1. 文件名应该简洁明了，不超过30个字符
2. 使用中文描述主要内容
3. 避免使用特殊字符，可以使用下划线或连字符
4. 重点突出图像的主要特征、场景或对象
5. 如果是人物照片，描述场景而不是具体人物
6. 如果是风景照片，描述地点特征或景观类型
7. 如果是物品照片，描述物品类型和特征

请按照以下JSON格式返回结果：
{
  "results": [
    {
      "filename": "建议的文件名",
      "description": "详细描述图像内容",
      "tags": ["标签1", "标签2", "标签3"],
      "confidence": 85
    }
  ]
}

确保为每个图像都提供一个结果，结果数量必须与图像数量一致。
`;

  constructor() {
    const config = getConfigManager();
    const apiKey = config.getApiKey();

    if (!apiKey) {
      throw new Error("Google Gemini API Key 未配置");
    }

    this.genAI = new GoogleGenAI(apiKey);
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * 分析单个图像
   * @param imagePath - 图像文件路径
   * @param userPrompt - 用户自定义提示词
   * @returns 分析结果
   */
  public async analyzeImage(
    imagePath: string,
    userPrompt?: string,
  ): Promise<AnalysisResult> {
    const results = await this.analyzeImages([imagePath], userPrompt);
    if (results.length === 0) {
      throw new Error("图像分析失败，未获得结果");
    }
    return results[0];
  }

  /**
   * 分析多个图像
   * @param imagePaths - 图像文件路径列表
   * @param userPrompt - 用户自定义提示词
   * @returns 分析结果列表
   */
  public async analyzeImages(
    imagePaths: string[],
    userPrompt?: string,
  ): Promise<AnalysisResult[]> {
    if (imagePaths.length === 0) {
      return [];
    }

    // 验证图像文件
    const validImages = [];
    for (const imagePath of imagePaths) {
      if (FileUtils.fileExists(imagePath) && FileUtils.isImageFile(imagePath)) {
        validImages.push(imagePath);
      } else {
        console.warn(`跳过无效图像文件: ${imagePath}`);
      }
    }

    if (validImages.length === 0) {
      throw new Error("没有有效的图像文件");
    }

    // 优化图像以适应 AI 分析
    const optimizedImages =
      await this.imageProcessor.batchOptimizeForAI(validImages);

    try {
      // 发送分析请求
      const request: AnalysisRequest = {
        imagePaths: optimizedImages,
        userPrompt,
        parseMultiple: true,
        requestId: `req_${Date.now()}`,
      };

      const results = await this.sendAnalysisRequest(request);

      // 映射结果到原始文件路径
      return results.map((result, index) => ({
        ...result,
        originalPath: validImages[index] || imagePaths[index],
      }));
    } finally {
      // 清理优化后的临时图像
      this.imageProcessor.cleanup();
    }
  }

  /**
   * 批量分析图像（支持自动分批）
   * @param imagePaths - 图像文件路径列表
   * @param userPrompt - 用户自定义提示词
   * @param onProgress - 进度回调
   * @returns 批量处理结果
   */
  public async batchAnalyzeImages(
    imagePaths: string[],
    userPrompt?: string,
    onProgress?: (
      current: number,
      total: number,
      currentBatch: number,
      totalBatches: number,
    ) => void,
  ): Promise<{
    results: AnalysisResult[];
    stats: BatchProcessingStats;
  }> {
    const startTime = Date.now();
    const config = getConfigManager();
    const batchConfig = config.getBatchProcessingConfig();

    // 分批处理
    const batches = this.createBatches(imagePaths, batchConfig.batchSize);
    const allResults: AnalysisResult[] = [];
    let totalTokensUsed = 0;
    let successfulBatches = 0;
    let failedBatches = 0;
    let processedFiles = 0;

    if (config.isDebugMode()) {
      console.log(`开始批量分析 ${imagePaths.length} 个图像文件`);
      console.log(
        `分为 ${batches.length} 批，每批最多 ${batchConfig.batchSize} 个文件`,
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      if (onProgress) {
        onProgress(
          processedFiles,
          imagePaths.length,
          batchNumber,
          batches.length,
        );
      }

      try {
        if (config.isVerboseMode()) {
          console.log(
            `处理第 ${batchNumber}/${batches.length} 批，包含 ${batch.length} 个文件`,
          );
        }

        const batchResults = await this.analyzeImages(batch, userPrompt);
        allResults.push(...batchResults);
        successfulBatches++;

        // 估算使用的 token 数量
        totalTokensUsed += this.estimateTokenUsage(batch, batchResults);

        if (config.isDebugMode()) {
          console.log(
            `第 ${batchNumber} 批处理完成，获得 ${batchResults.length} 个结果`,
          );
        }
      } catch (error) {
        console.error(`第 ${batchNumber} 批处理失败:`, error);
        failedBatches++;
      }

      processedFiles += batch.length;
    }

    const endTime = Date.now();
    const stats: BatchProcessingStats = {
      totalFiles: imagePaths.length,
      successfulFiles: allResults.length,
      failedFiles: imagePaths.length - allResults.length,
      averageConfidence: this.calculateAverageConfidence(allResults),
      totalProcessingTime: endTime - startTime,
      tokensUsed: totalTokensUsed,
      batchStats: {
        totalBatches: batches.length,
        successfulBatches,
        failedBatches,
      },
    };

    return { results: allResults, stats };
  }

  /**
   * 发送分析请求到 AI 服务
   * @param request - 分析请求
   * @returns 分析结果
   */
  private async sendAnalysisRequest(
    request: AnalysisRequest,
  ): Promise<AnalysisResult[]> {
    const config = getConfigManager();
    const model = this.genAI.getGenerativeModel({
      model: config.get("defaultModel"),
    });

    // 准备图像数据
    const imageParts = [];
    for (const imagePath of request.imagePaths) {
      const imageData = readFileSync(imagePath);
      imageParts.push({
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: this.getMimeType(imagePath),
        },
      });
    }

    // 构建提示词
    const prompt = request.userPrompt || AIAnalyzer.DEFAULT_PROMPT;
    const fullPrompt = `${prompt}\n\n图像数量: ${request.imagePaths.length}`;

    if (config.isDebugMode()) {
      console.log("发送给 AI 的提示词:", fullPrompt);
      console.log("图像数量:", request.imagePaths.length);
    }

    try {
      // 发送请求
      const result = await model.generateContent([fullPrompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      if (config.isDebugMode()) {
        console.log("AI 响应:", text);
      }

      // 解析响应
      return this.parseAnalysisResponse(text, request.imagePaths);
    } catch (error) {
      throw new Error(
        `AI 分析请求失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 解析 AI 响应
   * @param responseText - AI 响应文本
   * @param imagePaths - 图像路径列表
   * @returns 解析后的结果
   */
  private parseAnalysisResponse(
    responseText: string,
    imagePaths: string[],
  ): AnalysisResult[] {
    try {
      // 清理响应文本，移除可能的 markdown 格式
      const cleanedText = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleanedText);
      const results = parsed.results || [];

      // 确保结果数量与图像数量匹配
      if (results.length !== imagePaths.length) {
        console.warn(
          `结果数量 (${results.length}) 与图像数量 (${imagePaths.length}) 不匹配`,
        );
      }

      return results.map((result: any, index: number) => ({
        originalPath: imagePaths[index] || "",
        suggestedName: FileUtils.sanitizeFilename(
          result.filename || `image_${index + 1}`,
        ),
        description: result.description || "无描述",
        tags: Array.isArray(result.tags) ? result.tags : [],
        confidence:
          typeof result.confidence === "number" ? result.confidence : 70,
        timestamp: Date.now(),
        filename: result.filename || `image_${index + 1}`,
      }));
    } catch (error) {
      console.error("解析 AI 响应失败:", error);

      // 创建默认结果
      return imagePaths.map((imagePath, index) => ({
        originalPath: imagePath,
        suggestedName: `image_${index + 1}`,
        description: "解析失败，使用默认命名",
        tags: [],
        confidence: 50,
        timestamp: Date.now(),
        filename: `image_${index + 1}`,
      }));
    }
  }

  /**
   * 创建批次
   * @param items - 要分批的项目
   * @param batchSize - 批次大小
   * @returns 批次数组
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 估算 token 使用量
   * @param imagePaths - 图像路径列表
   * @param results - 分析结果
   * @returns 估算的 token 数量
   */
  private estimateTokenUsage(
    imagePaths: string[],
    results: AnalysisResult[],
  ): number {
    // 基础 token 使用量（提示词）
    const baseTokens = 500;

    // 每个图像的 token 使用量（估算）
    const tokensPerImage = 200;

    // 响应的 token 使用量
    const responseTokens = results.reduce((total, result) => {
      return total + result.description.length / 4 + result.tags.length * 10;
    }, 0);

    return baseTokens + imagePaths.length * tokensPerImage + responseTokens;
  }

  /**
   * 计算平均置信度
   * @param results - 分析结果列表
   * @returns 平均置信度
   */
  private calculateAverageConfidence(results: AnalysisResult[]): number {
    if (results.length === 0) return 0;

    const totalConfidence = results.reduce(
      (sum, result) => sum + result.confidence,
      0,
    );
    return Math.round(totalConfidence / results.length);
  }

  /**
   * 获取图像的 MIME 类型
   * @param imagePath - 图像路径
   * @returns MIME 类型
   */
  private getMimeType(imagePath: string): string {
    const extension = FileUtils.getFileExtension(imagePath);

    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "bmp":
        return "image/bmp";
      case "tiff":
        return "image/tiff";
      case "svg":
        return "image/svg+xml";
      default:
        return "image/jpeg";
    }
  }

  /**
   * 测试 API 连接
   * @returns 测试结果
   */
  public async testConnection(): Promise<{
    success: boolean;
    error?: string;
    model?: string;
  }> {
    try {
      const config = getConfigManager();
      const model = this.genAI.getGenerativeModel({
        model: config.get("defaultModel"),
      });

      // 发送简单测试请求
      const result = await model.generateContent(
        'Hello, this is a test message. Please respond with "Test successful".',
      );
      const response = await result.response;
      const _text = response.text();

      return {
        success: true,
        model: config.get("defaultModel"),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 销毁分析器
   */
  public destroy(): void {
    this.imageProcessor.destroy();
  }
}

/**
 * 批量处理器
 * 专门处理大量图像的分析任务
 */
export class AIBatchProcessor {
  private analyzer: AIAnalyzer;

  constructor() {
    this.analyzer = new AIAnalyzer();
  }

  /**
   * 智能批量处理
   * 根据文件大小和数量自动调整批次大小
   * @param imagePaths - 图像路径列表
   * @param userPrompt - 用户提示词
   * @param onProgress - 进度回调
   * @returns 处理结果
   */
  public async smartBatchProcess(
    imagePaths: string[],
    userPrompt?: string,
    onProgress?: (
      current: number,
      total: number,
      currentBatch: number,
      totalBatches: number,
    ) => void,
  ): Promise<{
    results: AnalysisResult[];
    stats: BatchProcessingStats;
  }> {
    const config = getConfigManager();

    // 根据文件数量动态调整批次大小
    const optimalBatchSize = this.calculateOptimalBatchSize(imagePaths.length);

    // 临时更新配置
    const originalBatchSize = config.getBatchProcessingConfig().batchSize;
    config.setBatchProcessingConfig({ batchSize: optimalBatchSize });

    try {
      const result = await this.analyzer.batchAnalyzeImages(
        imagePaths,
        userPrompt,
        onProgress,
      );
      return result;
    } finally {
      // 恢复原始配置
      config.setBatchProcessingConfig({ batchSize: originalBatchSize });
    }
  }

  /**
   * 计算最优批次大小
   * @param totalFiles - 总文件数
   * @returns 最优批次大小
   */
  private calculateOptimalBatchSize(totalFiles: number): number {
    if (totalFiles <= 10) return totalFiles;
    if (totalFiles <= 50) return 10;
    if (totalFiles <= 100) return 20;
    if (totalFiles <= 500) return 40;
    return 50;
  }

  /**
   * 销毁批量处理器
   */
  public destroy(): void {
    this.analyzer.destroy();
  }
}
