/**
 * 图像处理器
 * 提供图像压缩、优化、格式转换等功能
 */

import { unlinkSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { getConfigManager } from "@/core/config";
import type { CleanupFunction, ImageProcessOptions } from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { getSignalHandler } from "@/utils/signal-handler";

export class ImageProcessor {
  /** 临时文件清理列表 */
  private tempFiles: string[] = [];
  /** 清理函数 */
  private cleanupFunction: CleanupFunction;

  constructor() {
    // 注册清理函数到信号处理器
    this.cleanupFunction = this.cleanup.bind(this);
    getSignalHandler().addCleanupFunction(this.cleanupFunction);
  }

  /**
   * 处理单个图像文件
   * @param imagePath - 图像文件路径
   * @param options - 处理选项
   * @returns 处理后的图像路径
   */
  public async processImage(
    imagePath: string,
    options?: Partial<ImageProcessOptions>,
  ): Promise<string> {
    // 检查图像文件
    if (!FileUtils.fileExists(imagePath)) {
      throw new Error(`图像文件不存在: ${imagePath}`);
    }

    if (!FileUtils.isImageFile(imagePath)) {
      throw new Error(`不是有效的图像文件: ${imagePath}`);
    }

    // 获取配置
    const config = getConfigManager();
    const processOptions = { ...config.getImageProcessingConfig(), ...options };

    // 创建临时文件路径
    const tempDir = FileUtils.getTempDir();
    const outputPath = join(
      tempDir,
      `processed_${Date.now()}.${processOptions.format}`,
    );

    try {
      // 创建 sharp 实例
      let sharpInstance = sharp(imagePath);

      // 获取图像信息
      const metadata = await sharpInstance.metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      if (config.isDebugMode()) {
        console.log(`处理图像: ${imagePath}`);
        console.log(`原始尺寸: ${originalWidth}x${originalHeight}`);
      }

      // 计算新的尺寸
      const newSize = this.calculateNewSize(
        originalWidth,
        originalHeight,
        processOptions.maxWidth,
        processOptions.maxHeight,
        processOptions.keepAspectRatio,
      );

      // 应用尺寸调整
      if (
        newSize.width !== originalWidth ||
        newSize.height !== originalHeight
      ) {
        // 将图像调整为指定宽度、高度或宽度 x 高度。
        sharpInstance = sharpInstance.resize(newSize.width, newSize.height, {
          fit: processOptions.keepAspectRatio ? "inside" : "fill",
          withoutEnlargement: true,
        });

        if (config.isDebugMode()) {
          console.log(`调整尺寸到: ${newSize.width}x${newSize.height}`);
        }
      }

      // 应用格式转换和质量设置
      switch (processOptions.format) {
        case "jpeg":
        case "jpg":
          sharpInstance = sharpInstance.jpeg({
            quality: processOptions.quality,
            progressive: true,
          });
          break;
        case "png":
          // PNG 使用压缩级别而不是质量
          sharpInstance = sharpInstance.png({
            compressionLevel: Math.round(
              9 - (processOptions.quality / 100) * 9,
            ),
          });
          break;
        case "webp":
          sharpInstance = sharpInstance.webp({
            quality: processOptions.quality,
          });
          break;
        default:
          // 保持原格式
          break;
      }

      // 保存处理后的图像
      await sharpInstance.toFile(outputPath);

      // 添加到临时文件列表
      this.tempFiles.push(outputPath);

      if (config.isDebugMode()) {
        const processedInfo = await sharp(outputPath).metadata();
        console.log(`处理完成: ${processedInfo.width}x${processedInfo.height}`);
      }

      return outputPath;
    } catch (error) {
      // 清理可能创建的临时文件
      this.cleanupTempFiles([outputPath]);
      throw new Error(
        `图像处理失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 批量处理图像文件
   * @param imagePaths - 图像文件路径列表
   * @param options - 处理选项
   * @param onProgress - 进度回调
   * @returns 处理后的图像路径列表
   */
  // public async batchProcessImages(
  //   imagePaths: string[],
  //   options?: Partial<ImageProcessOptions>,
  //   onProgress?: (current: number, total: number, currentFile: string) => void,
  // ): Promise<string[]> {
  //   const results: string[] = [];
  //   const total = imagePaths.length;

  //   for (let i = 0; i < imagePaths.length; i++) {
  //     const imagePath = imagePaths[i];

  //     if (onProgress) {
  //       onProgress(i + 1, total, imagePath);
  //     }

  //     try {
  //       // TODO 同步处理 or 并发处理？
  //       const processedPath = await this.processImage(imagePath, options);
  //       results.push(processedPath);
  //     } catch (error) {
  //       console.error(`处理图像文件失败 ${imagePath}:`, error);
  //       // 继续处理其他文件，不中断整个批量处理
  //     }
  //   }

  //   return results;
  // }

  /**
   * 优化图像以适应 AI 分析
   * @param imagePath - 图像文件路径
   * @returns 优化后的图像路径
   */
  public async optimizeForAI(imagePath: string) {
    const aiOptimizedOptions: ImageProcessOptions = {
      quality: 85,
      maxWidth: 1024,
      maxHeight: 1024,
      keepAspectRatio: true,
      format: "jpeg",
    };

    return this.processImage(imagePath, aiOptimizedOptions);
  }

  /**
   * 批量优化图像以适应 AI 分析
   * @param imagePaths - 图像文件路径列表
   * @param onProgress - 进度回调
   * @returns 优化后的图像路径列表
   */
  public async batchOptimizeForAI(
    imagePaths: string[],
    onProgress?: (current: number, total: number, currentFile: string) => void,
  ): Promise<string[]> {
    const results: string[] = [];
    const total = imagePaths.length;

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      if (onProgress) {
        onProgress(i + 1, total, imagePath);
      }

      try {
        const optimizedPath = await this.optimizeForAI(imagePath);
        results.push(optimizedPath);
      } catch (error) {
        console.error(`优化图像文件失败 ${imagePath}:`, error);
        // 继续处理其他文件，不中断整个批量处理
      }
    }

    return results;
  }

  /**
   * 计算新的图像尺寸
   * @param originalWidth - 原始宽度
   * @param originalHeight - 原始高度
   * @param maxWidth - 最大宽度
   * @param maxHeight - 最大高度
   * @param keepAspectRatio - 是否保持宽高比
   * @returns 新的尺寸
   */
  private calculateNewSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
    keepAspectRatio: boolean,
  ): { width: number; height: number } {
    if (!keepAspectRatio) {
      return { width: maxWidth, height: maxHeight };
    }

    // 如果图像尺寸已经符合要求，不需要调整
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    // 计算缩放比例
    const widthRatio = maxWidth / originalWidth;
    const heightRatio = maxHeight / originalHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio),
    };
  }

  /**
   * 获取图像信息
   * @param imagePath - 图像文件路径
   * @returns 图像信息
   */
  public async getImageInfo(imagePath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    hasAlpha: boolean;
  }> {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = require("node:fs").statSync(imagePath);

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || "unknown",
        size: stats.size,
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error) {
      throw new Error(
        `获取图像信息失败: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 批量获取图像信息
   * @param imagePaths - 图像文件路径列表
   * @returns 图像信息列表
   */
  public async batchGetImageInfo(imagePaths: string[]): Promise<
    Array<{
      path: string;
      width: number;
      height: number;
      format: string;
      size: number;
      hasAlpha: boolean;
    }>
  > {
    const results: Array<{
      path: string;
      width: number;
      height: number;
      format: string;
      size: number;
      hasAlpha: boolean;
    }> = [];

    for (const imagePath of imagePaths) {
      try {
        const info = await this.getImageInfo(imagePath);
        results.push({ path: imagePath, ...info });
      } catch (error) {
        console.error(`获取图像信息失败 ${imagePath}:`, error);
      }
    }

    return results;
  }

  /**
   * 验证图像文件
   * @param imagePath - 图像文件路径
   * @returns 是否为有效图像
   */
  public async validateImage(imagePath: string) {
    try {
      await sharp(imagePath).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 批量验证图像文件
   * @param imagePaths - 图像文件路径列表
   * @returns 验证结果
   */
  public async batchValidateImages(imagePaths: string[]): Promise<{
    valid: string[];
    invalid: string[];
  }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const imagePath of imagePaths) {
      if (await this.validateImage(imagePath)) {
        valid.push(imagePath);
      } else {
        invalid.push(imagePath);
      }
    }

    return { valid, invalid };
  }

  /**
   * 清理临时文件
   * @param filePaths - 要清理的文件路径列表
   */
  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (FileUtils.fileExists(filePath)) {
          unlinkSync(filePath);
        }
      } catch (error) {
        if (getConfigManager().isDebugMode()) {
          console.warn(`清理临时文件失败 ${filePath}:`, error);
        }
      }
    }
  }

  /**
   * 清理所有临时文件
   */
  public cleanup(): void {
    this.cleanupTempFiles(this.tempFiles);
    this.tempFiles = [];
  }

  /**
   * 销毁处理器
   */
  public destroy(): void {
    // 从信号处理器中移除清理函数
    getSignalHandler().removeCleanupFunction(this.cleanupFunction);
    this.cleanup();
  }

  /**
   * 获取支持的图像格式
   * @returns 支持的图像格式列表
   */
  public static getSupportedFormats(): string[] {
    return FileUtils.getSupportedFormats().images;
  }

  /**
   * 估算处理后的文件大小
   * @param originalSize - 原始文件大小
   * @param quality - 质量设置
   * @param newWidth - 新宽度
   * @param newHeight - 新高度
   * @param originalWidth - 原始宽度
   * @param originalHeight - 原始高度
   * @returns 估算的文件大小
   */
  public static estimateProcessedSize(
    originalSize: number,
    quality: number,
    newWidth: number,
    newHeight: number,
    originalWidth: number,
    originalHeight: number,
  ): number {
    // 计算像素比例
    const pixelRatio =
      (newWidth * newHeight) / (originalWidth * originalHeight);

    // 计算质量影响
    const qualityFactor = quality / 100;

    // 估算新文件大小
    return Math.round(originalSize * pixelRatio * qualityFactor);
  }
}
