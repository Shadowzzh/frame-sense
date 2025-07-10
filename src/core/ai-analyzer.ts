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
import { UIUtils } from "@/utils/ui-utils";

export class AIAnalyzer {
  /** Google Generative AI 实例 */
  private genAI: GoogleGenAI;
  /** 图像处理器实例 */
  private imageProcessor: ImageProcessor;
  /** 默认自定义内容模板 */
  private static readonly DEFAULT_CUSTOM_CONTENT = `
请分析这些图像的内容，并为每个图像生成一个描述性的文件名。

要求：
- 文件名长度{{filenameLength}}个字符。
- 使用中文描述主要内容
- 避免使用特殊字符，可以使用下划线或连字符
- 重点突出图像的主要特征、场景或对象
- 如果是人物照片，描述场景而不是具体人物
- 如果是风景照片，描述地点特征或景观类型
- 如果是物品照片，描述物品类型和特征`;

  /** 固定的 JSON 格式要求（不可修改） */
  private static readonly FIXED_JSON_FORMAT = `

请按照以下JSON格式返回结果：
{
  "results": [
    {
      "filename": "建议的文件名",
    }
  ]
}

确保为每个图像都提供一个结果，结果数量必须与图像数量一致。`;

  constructor() {
    const config = getConfigManager();
    const apiKey = config.getApiKey();

    if (!apiKey) {
      throw new Error("Google Gemini API Key 未配置");
    }

    this.genAI = new GoogleGenAI({ apiKey });
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * 生成提示词
   * @param userPrompt - 用户自定义提示词
   * @returns 生成的提示词
   */
  private generatePrompt(userPrompt?: string): string {
    const config = getConfigManager();
    const promptConfig = config.getPromptConfig();

    // 如果用户提供了自定义提示词，直接使用（完全覆盖）
    if (userPrompt) {
      return userPrompt;
    }

    // 获取自定义内容部分
    let customContent: string;
    if (promptConfig.customTemplate) {
      // 使用用户自定义的内容模板
      customContent = promptConfig.customTemplate.replace(
        /\{\{filenameLength\}\}/g,
        promptConfig.filenameLength.toString(),
      );
    } else {
      // 使用默认内容模板
      customContent = AIAnalyzer.DEFAULT_CUSTOM_CONTENT.replace(
        /\{\{filenameLength\}\}/g,
        promptConfig.filenameLength.toString(),
      );
    }

    // 组合自定义内容和固定的 JSON 格式要求
    return customContent + AIAnalyzer.FIXED_JSON_FORMAT;
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
    const validImages: string[] = [];

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
    let successfulBatches = 0;
    let failedBatches = 0;
    let processedFiles = 0;

    if (config.isVerboseMode()) {
      console.log(`开始批量分析 ${imagePaths.length} 个图像文件`);
      console.log(
        `分为 ${batches.length} 批，每批最多 ${batchConfig.batchSize} 个文件`,
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      try {
        if (config.isVerboseMode()) {
          console.log(
            `处理第 ${batchNumber}/${batches.length} 批，包含 ${batch.length} 个文件`,
          );
        }

        const batchResults = await this.analyzeImages(batch, userPrompt);
        allResults.push(...batchResults);
        successfulBatches++;

        if (config.isVerboseMode()) {
          console.log(
            `第 ${batchNumber} 批处理完成，获得 ${batchResults.length} 个结果`,
          );
        }
      } catch (error) {
        console.error(`第 ${batchNumber} 批处理失败:`, error);
        failedBatches++;
      }

      processedFiles += batch.length;

      if (onProgress) {
        onProgress(
          processedFiles,
          imagePaths.length,
          batchNumber,
          batches.length,
        );
      }
    }

    const endTime = Date.now();
    const stats: BatchProcessingStats = {
      totalFiles: imagePaths.length,
      successfulFiles: allResults.length,
      failedFiles: imagePaths.length - allResults.length,
      totalProcessingTime: endTime - startTime,
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
    const prompt = this.generatePrompt(request.userPrompt);
    const fullPrompt = `${prompt}\n\n图像数量: ${request.imagePaths.length}`;

    if (config.isVerboseMode()) {
      UIUtils.logDebug(
        `图像 base64 大小: ${FileUtils.formatFileSize(
          imageParts.reduce(
            (sum, p) => sum + FileUtils.base64EncodedSize(p.inlineData.data),
            0,
          ),
        )}`,
      );
      UIUtils.logDebug(`发送给 AI 的提示词: ${fullPrompt}`);
    }

    try {
      // 发送请求
      const result = await this.genAI.models.generateContent({
        model: config.get("defaultModel") as string,
        contents: [fullPrompt, ...imageParts],
      });
      const text = result.text || "";

      if (config.isVerboseMode()) {
        console.log(
          "AI 使用情况:",
          JSON.stringify(result.usageMetadata, null, 2),
        );
        console.log("AI 响应:", text);
      }

      // 解析响应
      const analysisReponse = this.parseAnalysisResponse(
        text,
        request.imagePaths,
      );
      return analysisReponse;
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

      // 修复 JSON 中的常见错误：移除对象末尾的多余逗号
      const fixedJson = cleanedText
        .replace(/,(\s*})/g, "$1") // 移除对象末尾的逗号
        .replace(/,(\s*\])/g, "$1"); // 移除数组末尾的逗号

      const parsed = JSON.parse(fixedJson);

      const results: {
        filename?: string;
        description?: string;
        tags?: string[];
      }[] = parsed.results || [];

      // 确保结果数量与图像数量匹配
      if (results.length !== imagePaths.length) {
        console.warn(
          `结果数量 (${results.length}) 与图像数量 (${imagePaths.length}) 不匹配`,
        );
      }

      const analysisResult = results.map((result, index: number) => ({
        originalPath: imagePaths[index] || "",
        suggestedName: FileUtils.sanitizeFilename(
          result.filename || `image_${index + 1}`,
        ),
        description: result.description || "无描述",
        tags: Array.isArray(result.tags) ? result.tags : [],
        timestamp: Date.now(),
        filename: result.filename || `image_${index + 1}`,
      }));

      return analysisResult;
    } catch (error) {
      console.error("解析 AI 响应失败:", error);

      // 创建默认结果
      return imagePaths.map((imagePath, index) => ({
        originalPath: imagePath,
        suggestedName: `image_${index + 1}`,
        description: "解析失败，使用默认命名",
        tags: [],
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

      // 发送简单测试请求
      const result = await this.genAI.models.generateContent({
        model: config.get("defaultModel") as string,
        contents:
          'Hello, this is a test message. Please respond with "Test successful".',
      });
      const _text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        success: true,
        model: config.get("defaultModel") as string,
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

    // 临时更新配置
    const originalBatchSize = config.getBatchProcessingConfig().batchSize;

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
   * 销毁批量处理器
   */
  public destroy(): void {
    this.analyzer.destroy();
  }
}
