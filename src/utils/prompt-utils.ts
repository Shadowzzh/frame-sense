/**
 * 提示工具 - 统一处理用户输入和 Ctrl+C 信号
 */

import inquirer from "inquirer";

/**
 * 安全的 inquirer 提示，自动处理 Ctrl+C 退出
 */
export async function safePrompt<T>(
  questions: Parameters<typeof inquirer.prompt>[0],
  options?: {
    exitMessage?: string;
    exitCode?: number;
  },
): Promise<T | null> {
  const { exitMessage = "✗ 操作已取消", exitCode = 0 } = options || {};

  try {
    return (await inquirer.prompt(questions)) as T;
  } catch (error) {
    // 如果是用户取消操作（Ctrl+C），优雅退出
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log(`\n${exitMessage}`);
      process.exit(exitCode);
    }
    throw error;
  }
}
