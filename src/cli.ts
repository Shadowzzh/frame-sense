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
  .option("-c, --config <path>", "指定配置文件路径")
  .option("--frames <number>", "每个视频提取的关键帧数量", "2")
  .option("--format <format>", "命名格式 (semantic|structured)", "semantic")
  .option("--dry-run", "预览重命名结果，不执行实际重命名")
  .option("--verbose", "显示详细日志")
  .option("--image-width <number>", "图片优化宽度", "1280")
  .option("--image-height <number>", "图片优化高度", "720")
  .option("--image-quality <number>", "图片优化质量 (1-100)", "75")
  .action(async (options: Record<string, unknown>) => {
    showWelcome();

    try {
      // 初始化配置
      const config = new FrameSenseConfig(options.config as string);

      // 合并命令行选项到配置
      const baseConfig = config.getConfig();
      const { imageWidth, imageHeight, imageQuality, ...cleanOptions } =
        options;
      const mergedOptions = {
        ...baseConfig,
        ...cleanOptions,
        frames: Number.parseInt(options.frames as string, 10),
        imageOptimize: {
          width: imageWidth
            ? Number.parseInt(imageWidth as string, 10)
            : baseConfig.imageOptimize?.width || 1280,
          height: imageHeight
            ? Number.parseInt(imageHeight as string, 10)
            : baseConfig.imageOptimize?.height || 720,
          quality: imageQuality
            ? Number.parseInt(imageQuality as string, 10)
            : baseConfig.imageOptimize?.quality || 75,
        },
      };
      console.log("🚀 ~ .action ~ mergedOptions:", mergedOptions);

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

// config 子命令
const configCommand = program.command("config").description("管理配置");

// config set 子命令
configCommand
  .command("set")
  .description("设置配置项")
  .argument("<key>", "配置键 (apiKey, model, frames, format)")
  .argument("<value>", "配置值")
  .action(async (key: string, value: string) => {
    try {
      const config = new FrameSenseConfig();

      // 验证配置键
      const validKeys = [
        "apiKey",
        "model",
        "frames",
        "format",
        "imageOptimize.width",
        "imageOptimize.height",
        "imageOptimize.quality",
      ];
      if (!validKeys.includes(key)) {
        console.error(chalk.red(`错误: 无效的配置键 "${key}"`));
        console.log(chalk.yellow(`有效的配置键: ${validKeys.join(", ")}`));
        process.exit(1);
      }

      // 转换值类型
      let convertedValue: unknown = value;
      if (key === "frames" || key.includes("imageOptimize")) {
        const numValue = Number.parseInt(value, 10);
        if (Number.isNaN(numValue)) {
          console.error(chalk.red(`错误: ${key} 必须是数字`));
          process.exit(1);
        }
        if (
          key === "imageOptimize.quality" &&
          (numValue < 1 || numValue > 100)
        ) {
          console.error(
            chalk.red(`错误: imageOptimize.quality 必须在 1-100 之间`),
          );
          process.exit(1);
        }
        convertedValue = numValue;
      } else if (key === "format") {
        if (!["semantic", "structured"].includes(value)) {
          console.error(
            chalk.red(`错误: format 必须是 semantic 或 structured`),
          );
          process.exit(1);
        }
      }

      // 处理嵌套配置
      if (key.startsWith("imageOptimize.")) {
        const currentConfig = config.getConfig();
        const imageOptimize = currentConfig.imageOptimize || {
          width: 1280,
          height: 720,
          quality: 75,
        };
        const subKey = key.split(".")[1] as keyof typeof imageOptimize;
        imageOptimize[subKey] = convertedValue as number;
        config.setConfig("imageOptimize", imageOptimize);
      } else {
        config.setConfig(key as keyof FrameSenseOptions, convertedValue);
      }
      console.log(chalk.green(`✅ 配置已设置: ${key} = ${value}`));
    } catch (error) {
      console.error(
        chalk.red("错误:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

// config get 子命令
configCommand
  .command("get")
  .description("获取配置项")
  .argument("<key>", "配置键")
  .action(async (key: string) => {
    try {
      const config = new FrameSenseConfig();
      const allConfig = config.getConfig();

      if (key in allConfig) {
        const value = allConfig[key as keyof FrameSenseOptions];
        console.log(chalk.cyan(`${key}: ${value}`));
      } else {
        console.error(chalk.red(`错误: 配置键 "${key}" 不存在`));
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

// config list 子命令
configCommand
  .command("list")
  .description("列出所有配置")
  .action(async () => {
    try {
      const config = new FrameSenseConfig();
      const allConfig = config.getConfig();

      console.log(chalk.blue("📋 当前配置:"));
      for (const [key, value] of Object.entries(allConfig)) {
        if (value !== undefined) {
          console.log(chalk.cyan(`  ${key}: ${value}`));
        }
      }

      console.log(chalk.gray(`\n配置文件路径: ${config.getConfigPath()}`));
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
      console.log(chalk.gray(`模型: ${options.model}`));

      // 创建 AI 分析器并测试连接
      const analyzer = new AIAnalyzer(options);

      // 发送一个简单的测试请求
      console.log(chalk.gray("发送测试请求..."));

      try {
        // 创建一个简单的文本生成测试
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
