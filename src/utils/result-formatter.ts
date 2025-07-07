/**
 * 结果格式化器
 */

import { basename } from "node:path";
import chalk from "chalk";
import type { FrameSenseOptions } from "@/config";
import type { ProcessResult } from "@/types";

/**
 * 显示处理结果
 */
export function displayResults(
  results: ProcessResult[],
  options: FrameSenseOptions,
): void {
  console.log();
  console.log(chalk.bold("处理结果:"));
  console.log();

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // 成功处理的文件
  if (successful.length > 0) {
    console.log(chalk.green(`✓ 成功处理 ${successful.length} 个文件:`));
    console.log();

    for (const result of successful) {
      console.log(chalk.gray(`  原名: ${basename(result.originalPath)}`));
      console.log(chalk.green(`  新名: ${result.newName}`));
      console.log();
    }
  }

  // 失败处理的文件
  if (failed.length > 0) {
    console.log(chalk.red(`✗ 失败 ${failed.length} 个文件:`));
    console.log();

    for (const result of failed) {
      console.log(chalk.red(`  文件: ${basename(result.originalPath)}`));
      console.log(chalk.red(`  错误: ${result.error}`));
      console.log();
    }
  }

  // 预览模式
  if (options.dryRun) {
    console.log(chalk.yellow("这是预览模式，未执行实际重命名"));
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
