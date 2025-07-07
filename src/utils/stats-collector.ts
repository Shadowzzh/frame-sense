/**
 * 统计收集器
 */

import chalk from "chalk";
import type { AIAnalyzer } from "@/ai-analyzer";
import { formatBytes } from "@/utils/result-formatter";

/**
 * 显示统计信息
 */
export function displayStats(aiAnalyzer: AIAnalyzer): void {
  const stats = aiAnalyzer.getStats();

  if (stats.totalFiles === 0) {
    return;
  }

  console.log();
  console.log(chalk.cyan("📊 AI 分析统计信息:"));
  console.log();

  console.log(chalk.gray(`  📁 处理文件数: ${stats.totalFiles} 个`));
  console.log(chalk.gray(`  📏 文件总大小: ${formatBytes(stats.totalSize)}`));
  console.log(
    chalk.gray(`  🔢 预估 Token: ${stats.estimatedTokens.toLocaleString()}`),
  );
  console.log(
    chalk.gray(`  📤 发送数据量: ${formatBytes(stats.sentDataSize)}`),
  );
  console.log();
}
