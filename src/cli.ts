import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { program } from "commander";
import figlet from "figlet";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { AIAnalyzer } from "./ai-analyzer.js";
import { FrameSenseConfig, type FrameSenseOptions } from "./config.js";
import { processFiles } from "./processor.js";

// 创建 EnvHttpProxyAgent 实例，它将自动读取环境变量
const envHttpProxyAgent = new EnvHttpProxyAgent();
setGlobalDispatcher(envHttpProxyAgent);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取版本信息
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

// 显示欢迎信息
function showWelcome() {
  console.log(
    chalk.cyan(
      figlet.textSync("Frame Sense", {
        width: 80,
        font: "3D-ASCII",
        horizontalLayout: "default",
        verticalLayout: "default",
        whitespaceBreak: true,
      }),
    ),
  );
  console.log(chalk.gray("基于 AI 的智能视频重命名工具"));
  console.log();
}

// 配置 CLI
program
  .name("frame-sense")
  .description("基于 AI 的图片视频重命名 CLI 工具")
  .version(packageJson.version);

// 主命令
program
  .option("-d, --directory <path>", "指定要处理的目录")
  .option("-f, --files <files...>", "指定要处理的文件列表")
  .option("--frames <number>", "每个视频提取的关键帧数量", "2")
  .option("--format <format>", "命名格式 (semantic|structured)", "semantic")
  .option("--dry-run", "预览重命名结果，不执行实际重命名")
  .action(async (options: Record<string, unknown>) => {
    showWelcome();

    try {
      // 初始化配置
      const config = new FrameSenseConfig();

      // 合并命令行选项到配置
      const baseConfig = config.getConfig();
      const mergedOptions = {
        ...baseConfig,
        ...options,
        frames: Number.parseInt(options.frames as string, 10),
      };

      // 验证输入
      if (!options.directory && !options.files) {
        console.error(chalk.red("错误: 必须指定目录或文件"));
        process.exit(1);
      }

      // 处理文件
      await processFiles(mergedOptions);
    } catch (error) {
      console.error(
        chalk.red("错误:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// config 子命令 - 保留基本配置功能
const configCommand = program.command("config").description("管理配置");

// config set 子命令
configCommand
  .command("set")
  .description("设置配置项")
  .argument("<key>", "配置键 (apiKey, model)")
  .argument("<value>", "配置值")
  .action(async (key: string, value: string) => {
    try {
      const config = new FrameSenseConfig();

      // 验证配置键
      const validKeys = ["apiKey", "model"];
      if (!validKeys.includes(key)) {
        console.error(chalk.red(`错误: 无效的配置键 "${key}"`));
        console.log(chalk.yellow(`有效的配置键: ${validKeys.join(", ")}`));
        process.exit(1);
      }

      config.setConfig(key as keyof FrameSenseOptions, value);
      console.log(chalk.green(`✅ 配置已设置: ${key} = ${value}`));
    } catch (error) {
      console.error(
        chalk.red("错误:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// config test 子命令
configCommand
  .command("test")
  .description("测试 API 连接")
  .action(async () => {
    try {
      const config = new FrameSenseConfig();
      const options = config.getConfig();

      // 检查 API 密钥配置
      if (!options.apiKey) {
        console.error(chalk.red("❌ 错误: 未配置 API 密钥"));
        console.log(
          chalk.yellow("请先运行: frame-sense config set apiKey '你的API密钥'"),
        );
        process.exit(1);
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
        console.error(
          chalk.red(error instanceof Error ? error.message : String(error)),
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red("错误:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();
