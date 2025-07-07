import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { FrameSenseOptions } from "@/config";

/**
 * 文件重命名器
 */
export class FileRenamer {
  /** 配置 */
  private options: FrameSenseOptions;
  /** 计数器 */
  private counter = new Map<string, number>();

  constructor(options: FrameSenseOptions) {
    this.options = options;
  }

  /**
   * 生成新文件名
   * @param originalPath 原始文件路径
   * @param analysis 分析结果
   * @param format 格式
   * @returns 新文件名
   */
  generateNewName(
    originalPath: string,
    analysis: string,
    format: "semantic" | "structured",
  ): string {
    const ext = extname(originalPath);
    const dir = dirname(originalPath);

    let baseName: string;

    if (format === "semantic") {
      baseName = this.generateSemanticName(analysis);
    } else {
      baseName = this.generateStructuredName(analysis);
    }

    // 清理文件名，移除不合法字符
    baseName = this.sanitizeFileName(baseName);

    // 检查重名并添加序号
    const finalName = this.ensureUniqueName(dir, baseName, ext);

    return finalName;
  }

  /**
   * 重命名文件
   * @param originalPath 原始文件路径
   * @param newName 新文件名
   */
  async renameFile(originalPath: string, newName: string): Promise<void> {
    const dir = dirname(originalPath);
    const newPath = join(dir, newName);

    if (originalPath === newPath) {
      return; // 文件名没有变化
    }

    if (existsSync(newPath)) {
      throw new Error(`目标文件已存在: ${newName}`);
    }

    try {
      await rename(originalPath, newPath);
    } catch (error) {
      throw new Error(
        `重命名失败: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * 生成语义主导型文件名
   * @param analysis 分析结果
   * @returns 新文件名
   */
  private generateSemanticName(analysis: string): string {
    // 语义主导型：<内容关键词>-<动作或主题>
    const words = analysis
      .split(/[\s，,。.、]+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return "未知内容";
    }

    if (words.length === 1) {
      return words[0] || "未知内容";
    }

    // 取前两个主要词汇
    const mainWords = words.slice(0, 2);
    return mainWords.join("-");
  }

  /**
   * 生成结构化文件名
   * @param analysis 分析结果
   * @returns 新文件名
   */
  private generateStructuredName(analysis: string): string {
    // 结构化格式：<YYYYMMDD>-<关键词>-<序号>
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const keywords = this.extractKeywords(analysis);

    return `${date}-${keywords}`;
  }

  /**
   * 提取关键词
   * @param analysis 分析结果
   * @returns 关键词
   */
  private extractKeywords(analysis: string): string {
    // 提取关键词并限制长度
    const words = analysis
      .split(/[\s，,。.、]+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return "未知";
    }

    // 取前3个词或者总长度不超过15字符
    let result = words[0] ?? "未知";
    for (let i = 1; i < words.length && result.length < 15; i++) {
      const candidate = `${result}-${words[i]}`;
      if (candidate.length <= 15) {
        result = candidate;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * 清理文件名
   * @param name 文件名
   * @returns 清理后的文件名
   */
  private sanitizeFileName(name: string): string {
    // 移除或替换不合法的文件名字符
    return (
      name
        .replace(/[<>:"/\\|?*]/g, "") // 移除不合法字符
        .replace(/\s+/g, "-") // 空格替换为连字符
        .replace(/--+/g, "-") // 多个连字符合并为一个
        .replace(/^-+|-+$/g, "") // 移除开头和结尾的连字符
        .substring(0, 50) || "未知"
    ); // 限制长度，避免空字符串
  }

  /**
   * 确保文件名唯一
   * @param dir 目录
   * @param baseName 文件名
   * @param ext 文件扩展名
   * @returns 唯一文件名
   */
  private ensureUniqueName(dir: string, baseName: string, ext: string): string {
    let fileName = `${baseName}${ext}`;
    let counter = 1;

    while (existsSync(join(dir, fileName))) {
      fileName = `${baseName}-${counter}${ext}`;
      counter++;
    }

    return fileName;
  }
}
