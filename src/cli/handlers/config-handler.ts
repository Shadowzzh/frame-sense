/**
 * 配置命令处理器
 */

import chalk from "chalk";
import { AIAnalyzer } from "@/ai-analyzer";
import { FrameSenseConfig, type FrameSenseOptions } from "@/config";
import { formatError } from "@/errors";

/**
 * 配置设置处理器
 */
export async function handleConfigSet(key: string, value: string) {
  try {
    const config = new FrameSenseConfig();

    // 验证配置键
    const validKeys = ["apiKey", "model"];
    if (!validKeys.includes(key)) {
      throw new Error(`无效的配置键 "${key}"`);
    }

    config.setConfig(key as keyof FrameSenseOptions, value);
    console.log(chalk.green(`✅ 配置已设置: ${key} = ${value}`));
  } catch (error) {
    console.error(chalk.red("错误:"), formatError(error));
    process.exit(1);
  }
}

/**
 * 配置测试处理器
 */
export async function handleConfigTest() {
  try {
    const config = new FrameSenseConfig();
    const options = config.getConfig();

    // 检查 API 密钥配置
    if (!options.apiKey) {
      throw new Error("未配置 API 密钥");
    }

    console.log(chalk.blue("🔄 正在测试 Gemini API 连接..."));

    // 创建 AI 分析器并测试连接
    const analyzer = new AIAnalyzer(options);

    try {
      const testResult = await analyzer.testConnection();
      console.log(chalk.green("✅ API 连接成功!"));
      console.log(chalk.gray(`响应: ${testResult}`));
    } catch (error) {
      console.error(chalk.red("❌ API 连接失败:"));
      console.error(chalk.red(formatError(error)));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red("错误:"), formatError(error));
    process.exit(1);
  }
}
