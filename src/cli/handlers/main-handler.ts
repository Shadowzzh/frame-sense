/**
 * 主命令处理器
 */

import chalk from "chalk";
import { FrameSenseConfig, type FrameSenseOptions } from "@/config";
import { formatError } from "@/errors";
import { processFiles } from "@/processor";

interface MainCommandOptions extends FrameSenseOptions {
  /** 文件目录 */
  directory?: string;
  /** 文件列表 */
  files?: string[];
}

/**
 * 主命令处理器
 */
export async function handleMainCommand(options: Record<string, unknown>) {
  try {
    // 初始化配置
    const config = new FrameSenseConfig();

    // 合并命令行选项到配置
    const baseConfig = config.getConfig();
    const mergedOptions: MainCommandOptions = {
      ...baseConfig,
      ...options,
      frames: Number.parseInt(options.frames as string, 10),
    };

    // 验证输入
    if (!options.directory && !options.files) {
      throw new Error("必须指定目录或文件");
    }

    // 处理文件
    await processFiles(mergedOptions);
  } catch (error) {
    console.error(chalk.red("错误:"), formatError(error));
    process.exit(1);
  }
}
