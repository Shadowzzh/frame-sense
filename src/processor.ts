import chalk from "chalk";
import ora from "ora";
import { AIAnalyzer } from "@/ai-analyzer";
import type { FrameSenseOptions } from "@/config";
import { processAllFiles } from "@/core/file-processor";
import { categorizeFiles, getFileList } from "@/core/file-scanner";
import { FileRenamer } from "@/file-renamer";
import { FrameExtractor } from "@/frame-extractor";
import { displayResults } from "@/utils/result-formatter";
import { displayStats } from "@/utils/stats-collector";

interface ProcessFilesOptions extends FrameSenseOptions {
  /** 文件目录 */
  directory?: string;
  /** 文件列表 */
  files?: string[];
}

/**
 * 处理文件
 * @param options 配置选项
 */
export async function processFiles(options: ProcessFilesOptions) {
  const spinner = ora("正在扫描文件...").start();

  try {
    // 获取要处理的文件列表
    const files = await getFileList(options);

    if (files.length === 0) {
      spinner.fail("未找到可处理的文件");
      return;
    }

    spinner.succeed(`发现 ${files.length} 个文件待处理`);

    console.log(chalk.gray("文件列表:"));
    for (const file of files) {
      console.log(chalk.gray(`  - ${file}`));
    }
    console.log();

    // 初始化处理器
    const frameExtractor = new FrameExtractor();

    // 初始化 AI 分析器
    const aiAnalyzer = new AIAnalyzer(options);

    // 初始化文件重命名器
    const fileRenamer = new FileRenamer(options);

    // 按文件类型分组
    const categorizedFiles = categorizeFiles(files);

    const results = await processAllFiles(categorizedFiles, {
      frameExtractor,
      aiAnalyzer,
      fileRenamer,
      options,
    });

    // 显示统计信息
    displayStats(aiAnalyzer);

    // 显示结果
    displayResults(results, options);
  } catch (error) {
    spinner.fail(`处理失败: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}
