import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { AIAnalyzer } from "@/ai-analyzer";
import { FrameSenseConfig, type FrameSenseOptions } from "@/config";
import { formatError } from "@/errors";
import { processFiles } from "@/processor";
import { logger } from "@/utils/logger";
import { getSignalHandler } from "@/utils/signal-handler";

// 创建 EnvHttpProxyAgent 实例，它将自动读取环境变量
const envHttpProxyAgent = new EnvHttpProxyAgent();
setGlobalDispatcher(envHttpProxyAgent);

// 初始化信号处理器
getSignalHandler();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取版本信息
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

interface MainCommandOptions extends FrameSenseOptions {
  /** 文件目录 */
  directory?: string;
  /** 文件列表 */
  files?: string[];
}

/**
 * 主命令处理器
 */
async function handleMainCommand(options: Record<string, unknown>) {
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
    logger.error(formatError(error));
    process.exit(1);
  }
}

/**
 * 配置设置处理器
 */
async function handleConfigSet(key: string, value: string) {
  try {
    const config = new FrameSenseConfig();

    // 验证配置键
    const validKeys = ["apiKey", "model", "frames", "format", "dryRun"];
    if (!validKeys.includes(key)) {
      logger.error(`❌ 无效的配置键 "${key}"`);
      logger.info("📝 可用的配置键:");
      logger.info("  apiKey - Gemini API 密钥");
      logger.info("  model - AI 模型名称 (默认: gemini-2.5-flash)");
      logger.info("  frames - 提取帧数 (默认: 2)");
      logger.info("  format - 命名格式 (semantic|structured, 默认: semantic)");
      logger.info("  dryRun - 预览模式 (true|false, 默认: false)");
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
    logger.success(`✅ 配置已设置: ${key} = ${processedValue}`);
  } catch (error) {
    logger.error(formatError(error));
    process.exit(1);
  }
}

/**
 * 配置显示处理器
 */
async function handleConfigShow() {
  try {
    const config = new FrameSenseConfig();
    const options = config.getConfig();

    logger.info("📋 当前配置:");
    logger.info(`  apiKey: ${options.apiKey ? "已设置" : "未设置"}`);
    logger.info(`  model: ${options.model || "未设置"}`);
    logger.info(`  frames: ${options.frames}`);
    logger.info(`  format: ${options.format}`);
    logger.info(`  dryRun: ${options.dryRun}`);

    logger.debug(`📁 配置文件位置: ${config.getConfigPath()}`);
  } catch (error) {
    logger.error(formatError(error));
    process.exit(1);
  }
}

/**
 * 配置测试处理器
 */
async function handleConfigTest() {
  try {
    const config = new FrameSenseConfig();
    const options = config.getConfig();

    // 检查 API 密钥配置
    if (!options.apiKey) {
      throw new Error("未配置 API 密钥");
    }

    logger.progress("🔄 正在测试 Gemini API 连接...");

    // 创建 AI 分析器并测试连接
    const analyzer = new AIAnalyzer(options);

    try {
      const testResult = await analyzer.testConnection();
      logger.success("✅ API 连接成功!");
      logger.debug(`响应: ${testResult}`);
    } catch (error) {
      logger.error("❌ API 连接失败:");
      logger.error(formatError(error));
      process.exit(1);
    }
  } catch (error) {
    logger.error(formatError(error));
    process.exit(1);
  }
}

// 配置 CLI
program
  .name("frame-sense")
  .description(packageJson.description)
  .version(packageJson.version);

// 主命令
program
  .option("-d, --directory <path>", "指定要处理的目录")
  .option("-f, --files <files...>", "指定要处理的文件列表")
  .option("--frames <number>", "每个视频提取的关键帧数量", "2")
  .option("--format <format>", "命名格式 (semantic|structured)", "semantic")
  .option("--dry-run", "预览重命名结果，不执行实际重命名")
  .option("-v, --verbose", "显示详细的调试信息")
  .action(async (options: Record<string, unknown>) => {
    await handleMainCommand(options);
  });

// config 子命令
const configCommand = program.command("config").description("配置管理");

configCommand
  .command("set <key> <value>")
  .description("设置配置项")
  .action(handleConfigSet);

configCommand
  .command("show")
  .description("显示当前配置")
  .action(handleConfigShow);

configCommand
  .command("test")
  .description("测试 API 连接")
  .action(handleConfigTest);

// 解析命令行参数
program.parse();
