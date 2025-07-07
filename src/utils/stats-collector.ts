/**
 * 统计收集器
 */

import type { AIAnalyzer } from "@/ai-analyzer";
import { logger } from "@/utils/logger";
import { formatBytes } from "@/utils/result-formatter";

/**
 * 显示统计信息
 */
export function displayStats(aiAnalyzer: AIAnalyzer): void {
  const stats = aiAnalyzer.getStats();

  if (stats.totalFiles === 0) {
    return;
  }

  logger.info("📊 AI 分析统计信息:");
  logger.debug(`  📁 处理文件数: ${stats.totalFiles} 个`);
  logger.debug(`  📏 文件总大小: ${formatBytes(stats.totalSize)}`);
  logger.debug(`  🔢 预估 Token: ${stats.estimatedTokens.toLocaleString()}`);
  logger.debug(`  📤 发送数据量: ${formatBytes(stats.sentDataSize)}`);
}
