/**
 * 结果格式化器
 */

import { basename } from "node:path";
import type { FrameSenseOptions } from "@/config";
import type { ProcessResult } from "@/types";
import { logger } from "@/utils/logger";

/**
 * 显示处理结果
 */
export function displayResults(
  results: ProcessResult[],
  options: FrameSenseOptions,
): void {
  logger.info("📋 处理结果:");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // 成功处理的文件
  if (successful.length > 0) {
    logger.success(`✓ 成功处理 ${successful.length} 个文件:`);

    for (const result of successful) {
      logger.info(`  原名: ${basename(result.originalPath)}`);
      logger.success(`  新名: ${result.newName}`);
    }
  }

  // 失败处理的文件
  if (failed.length > 0) {
    logger.fail(`✗ 失败 ${failed.length} 个文件:`);

    for (const result of failed) {
      logger.error(`  文件: ${basename(result.originalPath)}`);
      logger.error(`  错误: ${result.error}`);
    }
  }

  // 预览模式
  if (options.dryRun) {
    logger.warn("这是预览模式，未执行实际重命名");
  }
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
