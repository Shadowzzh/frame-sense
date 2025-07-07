/**
 * 配置命令定义
 */

import { Command } from "commander";
import {
  handleConfigSet,
  handleConfigTest,
} from "@/cli/handlers/config-handler";

/**
 * 创建配置命令
 */
export function createConfigCommand(): Command {
  const configCommand = new Command("config").description("管理配置");

  // config set 子命令
  configCommand
    .command("set")
    .description("设置配置项")
    .argument("<key>", "配置键 (apiKey, model)")
    .argument("<value>", "配置值")
    .action(handleConfigSet);

  // config test 子命令
  configCommand
    .command("test")
    .description("测试 API 连接")
    .action(handleConfigTest);

  return configCommand;
}
