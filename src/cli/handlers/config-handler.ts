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
    const validKeys = ["apiKey", "model", "frames", "format", "dryRun"];
    if (!validKeys.includes(key)) {
      console.error(chalk.red(`❌ 无效的配置键 "${key}"`));
      console.log(chalk.yellow("\n📝 可用的配置键:"));
      console.log(`${chalk.cyan("  apiKey")} - Gemini API 密钥`);
      console.log(
        `${chalk.cyan("  model")} - AI 模型名称 (默认: gemini-2.5-flash)`,
      );
      console.log(`${chalk.cyan("  frames")} - 提取帧数 (默认: 2)`);
      console.log(
        chalk.cyan("  format") +
          " - 命名格式 (semantic|structured, 默认: semantic)",
      );
      console.log(
        `${chalk.cyan("  dryRun")} - 预览模式 (true|false, 默认: false)`,
      );
      process.exit(1);
    }

    // 验证和转换配置值
    let processedValue: unknown = value;

    switch (key) {
      case "frames": {
        const framesNum = Number.parseInt(value);
        if (Number.isNaN(framesNum) || framesNum <= 0) {
          throw new Error("frames 必须是正整数");
        }
        processedValue = framesNum;
        break;
      }
      case "format":
        if (!["semantic", "structured"].includes(value)) {
          throw new Error("format 必须是 'semantic' 或 'structured'");
        }
        break;
      case "dryRun":
        if (!["true", "false"].includes(value.toLowerCase())) {
          throw new Error("dryRun 必须是 'true' 或 'false'");
        }
        processedValue = value.toLowerCase() === "true";
        break;
      case "apiKey":
        if (!value.trim()) {
          throw new Error("API 密钥不能为空");
        }
        break;
      case "model":
        if (!value.trim()) {
          throw new Error("模型名称不能为空");
        }
        break;
    }

    config.setConfig(key as keyof FrameSenseOptions, processedValue);
    console.log(chalk.green(`✅ 配置已设置: ${key} = ${processedValue}`));
  } catch (error) {
    console.error(chalk.red("错误:"), formatError(error));
    process.exit(1);
  }
}

/**
 * 配置显示处理器
 */
export async function handleConfigShow() {
  try {
    const config = new FrameSenseConfig();
    const options = config.getConfig();

    console.log(chalk.blue("📋 当前配置:"));
    console.log(
      `${chalk.cyan("  apiKey:")} ${options.apiKey ? "已设置" : "未设置"}`,
    );
    console.log(`${chalk.cyan("  model:")}${options.model || "未设置"}`);
    console.log(`${chalk.cyan("  frames:")} ${options.frames}`);
    console.log(`${chalk.cyan("  format:")} ${options.format}`);
    console.log(`${chalk.cyan("  dryRun:")} ${options.dryRun}`);

    console.log(chalk.gray(`\n📁 配置文件位置: ${config.getConfigPath()}`));
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
