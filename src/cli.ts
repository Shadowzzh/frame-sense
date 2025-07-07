import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { createConfigCommand } from "@/cli/commands/config-command";
import { handleMainCommand } from "@/cli/handlers/main-handler";
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
program.addCommand(createConfigCommand());

// 解析命令行参数
program.parse();
