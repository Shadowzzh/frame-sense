import { AI_ANALYZER_CONFIG } from "@/constants";
import { AI_PROMPTS } from "@/prompts";
import type { AnalysisRequest } from "@/types";
import { logger } from "@/utils/logger";

/**
 * 批量处理结果
 */
export interface BatchResult {
  /** 批次索引，从0开始 */
  batchIndex: number;
  /** 当前批次包含的图片路径列表 */
  imagePaths: string[];
  /** AI分析结果文本 */
  analysis: string;
  /** 批次处理是否成功 */
  success: boolean;
  /** 处理失败时的错误信息 */
  error?: string;
  /** 本批次消耗的tokens数量 */
  tokensUsed?: number;
}

/**
 * 批量处理统计
 */
export interface BatchStats {
  /** 总图片数量 */
  totalImages: number;
  /** 已处理的图片数量 */
  processedImages: number;
  /** 总批次数量 */
  totalBatches: number;
  /** 成功处理的批次数量 */
  successfulBatches: number;
  /** 失败的批次数量 */
  failedBatches: number;
  /** 总消耗的tokens数量 */
  totalTokens: number;
  /** 总重试次数 */
  totalRetries: number;
}

/**
 * AI 批量处理器 - 专门处理大量图片的智能分批
 */
export class AIBatchProcessor {
  /** 批量处理统计信息 */
  private batchStats: BatchStats = {
    totalImages: 0,
    processedImages: 0,
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    totalTokens: 0,
    totalRetries: 0,
  };

  constructor(
    /** AI分析函数，用于执行实际的图片分析 */
    private performAnalysis: (request: AnalysisRequest) => Promise<string>,
    /** 是否启用详细日志输出 */
    private verbose: boolean = false,
  ) {}

  /**
   * 处理大量图片的批量分析
   * @param imagePaths 待处理的图片路径数组
   * @returns 分析结果字符串，多个结果用|||分隔
   */
  async processBatch(imagePaths: string[]): Promise<string> {
    // 记录开始处理的日志
    logger.info(`🔄 使用批量处理模式处理 ${imagePaths.length} 张图片`);

    // 重置批量统计信息，为新的处理周期做准备
    this.batchStats = {
      totalImages: imagePaths.length,
      processedImages: 0,
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalTokens: 0,
      totalRetries: 0,
    };

    // 根据配置将图片分批处理
    const batches = this.createBatches(imagePaths);
    // 存储所有批次的分析结果
    const allDescriptions: string[] = [];

    // 记录分批信息
    logger.info(
      `📊 准备处理 ${imagePaths.length} 张图片，分为 ${batches.length} 批`,
    );

    // 逐个处理每个批次
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // 处理单个批次并获取结果
      const batchResult = await this.processSingleBatch(batch, i);

      if (batchResult.success) {
        // 成功的批次：解析分析结果
        // 如果结果包含分隔符，则分割；否则为每张图片使用相同的描述
        const descriptions = batchResult.analysis.includes("|||")
          ? batchResult.analysis.split("|||")
          : batchResult.imagePaths.map(() => batchResult.analysis);

        // 将当前批次的描述添加到总结果中
        allDescriptions.push(...descriptions);
        // 增加成功批次计数
        this.batchStats.successfulBatches++;
      } else {
        // 失败的批次：为每张图片添加默认描述
        const defaultDescriptions = batchResult.imagePaths.map(
          () => "图片内容",
        );
        allDescriptions.push(...defaultDescriptions);
        // 增加失败批次计数
        this.batchStats.failedBatches++;

        // 记录失败日志
        logger.warn(
          `⚠️ 批次 ${batchResult.batchIndex + 1} 处理失败: ${batchResult.error}`,
        );
      }

      // 更新已处理图片数量
      this.batchStats.processedImages += batch.length;
      // 更新总批次数量
      this.batchStats.totalBatches++;

      // 计算并显示处理进度
      const progress = Math.round(
        (this.batchStats.processedImages / this.batchStats.totalImages) * 100,
      );
      logger.progress(
        `📊 批量处理进度: ${progress}% (${this.batchStats.processedImages}/${this.batchStats.totalImages})`,
      );
    }

    // 记录最终的批量处理统计信息
    this.logBatchStats();

    // 确保描述数量与图片数量完全匹配
    // 如果描述不足，补充默认描述
    while (allDescriptions.length < imagePaths.length) {
      allDescriptions.push("图片内容");
    }

    // 如果描述过多，删除多余的描述
    if (allDescriptions.length > imagePaths.length) {
      allDescriptions.splice(imagePaths.length);
    }

    // 将所有描述用分隔符连接返回
    return allDescriptions.join("|||");
  }

  /**
   * 创建批次 - 智能分批算法
   * 根据最大批次大小和token限制来分批处理图片
   * @param imagePaths 待分批的图片路径数组
   * @returns 二维数组，每个子数组代表一个批次
   */
  private createBatches(imagePaths: string[]): string[][] {
    /** 存储所有批次的数组 */
    const batches: string[][] = [];
    /** 当前正在构建的批次 */
    let currentBatch: string[] = [];
    /** 当前批次的预估token数量 */
    let estimatedTokens = 0;

    // 遍历所有图片路径
    for (const imagePath of imagePaths) {
      // 获取单张图片的预估token数量
      const imageTokens = AI_ANALYZER_CONFIG.AVG_TOKENS_PER_IMAGE;

      // 检查是否需要创建新批次（达到最大批次大小或token限制）
      if (
        currentBatch.length >= AI_ANALYZER_CONFIG.MAX_BATCH_SIZE ||
        estimatedTokens + imageTokens >
          AI_ANALYZER_CONFIG.MAX_TOKENS_PER_REQUEST
      ) {
        // 如果当前批次不为空，则保存当前批次
        if (currentBatch.length > 0) {
          batches.push([...currentBatch]);
          // 重置当前批次和token计数
          currentBatch = [];
          estimatedTokens = 0;
        }
      }

      // 将当前图片添加到当前批次
      currentBatch.push(imagePath);
      // 累加token数量
      estimatedTokens += imageTokens;
    }

    // 添加最后一批（如果存在）
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 处理单个批次
   * @param imagePaths 当前批次的图片路径数组
   * @param batchIndex 批次索引
   * @returns 批次处理结果
   */
  private async processSingleBatch(
    imagePaths: string[],
    batchIndex: number,
  ): Promise<BatchResult> {
    // 初始化批次结果对象
    const result: BatchResult = {
      batchIndex,
      imagePaths,
      analysis: "",
      success: false,
    };

    /** 最大重试次数 */
    const maxRetries = 3;
    /** 当前重试次数 */
    let retryCount = 0;

    // 重试循环
    while (retryCount <= maxRetries) {
      try {
        // 如果启用详细日志，记录处理信息
        if (this.verbose) {
          logger.info(
            `🔄 处理批次 ${batchIndex + 1}，包含 ${imagePaths.length} 张图片 (尝试 ${retryCount + 1}/${maxRetries + 1})`,
          );
        }

        // 执行AI分析
        const analysis = await this.performAnalysis({
          imagePaths,
          promptText: AI_PROMPTS.IMAGE_ANALYSIS,
          parseMultipleResults: true,
        });

        // 设置成功结果
        result.analysis = analysis;
        result.success = true;
        // 计算并记录消耗的tokens
        result.tokensUsed =
          imagePaths.length * AI_ANALYZER_CONFIG.AVG_TOKENS_PER_IMAGE;
        this.batchStats.totalTokens += result.tokensUsed;

        // 如果启用详细日志，记录成功信息
        if (this.verbose) {
          logger.info(
            `✅ 批次 ${batchIndex + 1} 处理成功，预估消耗 ${result.tokensUsed} tokens`,
          );
        }

        return result;
      } catch (error) {
        // 增加重试次数
        retryCount++;
        this.batchStats.totalRetries++;

        // 提取错误信息
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (retryCount <= maxRetries) {
          // 还可以重试，记录警告日志
          logger.warn(
            `⚠️ 批次 ${batchIndex + 1} 处理失败，正在重试 (${retryCount}/${maxRetries}): ${errorMessage}`,
          );

          // 等待后重试，延迟时间递增
          await this.delay(1000 * retryCount);
        } else {
          // 达到最大重试次数，记录错误日志
          logger.error(
            `❌ 批次 ${batchIndex + 1} 处理失败，已达到最大重试次数: ${errorMessage}`,
          );

          // 设置失败结果
          result.error = errorMessage;
          result.success = false;
          return result;
        }
      }
    }

    return result;
  }

  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   * @returns Promise，在指定时间后resolve
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 记录批量处理统计信息
   * 在控制台输出详细的处理统计数据
   */
  private logBatchStats(): void {
    logger.info(`📊 批量处理统计:`);
    logger.info(`  总图片数: ${this.batchStats.totalImages}`);
    logger.info(`  处理批次: ${this.batchStats.totalBatches}`);
    logger.info(`  成功批次: ${this.batchStats.successfulBatches}`);
    logger.info(`  失败批次: ${this.batchStats.failedBatches}`);
    logger.info(`  总重试次数: ${this.batchStats.totalRetries}`);
    logger.info(`  预估总 tokens: ${this.batchStats.totalTokens}`);

    // 计算成功率
    const successRate =
      this.batchStats.totalBatches > 0
        ? Math.round(
            (this.batchStats.successfulBatches / this.batchStats.totalBatches) *
              100,
          )
        : 0;
    logger.info(`  成功率: ${successRate}%`);
  }

  /**
   * 获取批量处理统计信息
   * @returns 批量处理统计信息的副本
   */
  getBatchStats(): BatchStats {
    // 返回统计信息的副本，避免外部修改
    return { ...this.batchStats };
  }
}
