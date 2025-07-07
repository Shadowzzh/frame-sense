/**
 * CLI 欢迎信息工具
 */

import chalk from "chalk";
import figlet from "figlet";

/**
 * 显示欢迎信息
 */
export function showWelcome() {
  console.log(
    chalk.cyan(
      figlet.textSync("Frame Sense", {
        font: "3D-ASCII",
      }),
    ),
  );
  console.log();
  console.log(chalk.gray("基于 AI 的智能视频重命名工具"));
  console.log();
}
