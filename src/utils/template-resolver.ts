/**
 * 模板解析器
 * 处理文件名模板的变量替换和日期格式化
 */

import dayjs from "dayjs";
import type { FilenameTemplateConfig } from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { MetadataExtractor } from "@/utils/metadata-extractor";
import { progressLogger } from "@/utils/progress-logger";

export class TemplateResolver {
  /**
   * 解析文件名模板
   * @param template - 模板字符串，如 "2025-11${ai文案}" 或 "YYYY-MM-DD_${ai文案}"
   * @param aiSuggestedName - AI 分析的文件名
   * @param filePath - 原始文件路径
   * @param templateConfig - 模板配置
   * @returns 解析后的文件名
   */
  public static async resolveTemplate(
    template: string,
    aiSuggestedName: string,
    filePath: string,
    templateConfig: FilenameTemplateConfig,
  ): Promise<string> {
    try {
      let resolvedTemplate = template;

      // 1. 替换 AI 文案变量
      resolvedTemplate = TemplateResolver.replaceAiVariables(
        resolvedTemplate,
        aiSuggestedName,
      );

      // 2. 自动检测并处理日期时间替换
      if (TemplateResolver.hasDateTokens(resolvedTemplate)) {
        const fileDate = await TemplateResolver.extractFileDate(
          filePath,
          templateConfig.dateSource,
        );
        resolvedTemplate = TemplateResolver.replaceDateTokens(
          resolvedTemplate,
          fileDate,
        );
      }

      // 3. 清理并返回结果
      return FileUtils.sanitizeFilename(resolvedTemplate);
    } catch (error) {
      progressLogger.error(`模板解析失败: ${template}, ${error}`);
      // 如果模板解析失败，返回原始的 AI 建议名称
      return FileUtils.sanitizeFilename(aiSuggestedName);
    }
  }

  /**
   * 替换 AI 文案变量
   * @param template - 模板字符串
   * @param aiSuggestedName - AI 建议的文件名
   * @returns 替换后的模板
   */
  private static replaceAiVariables(
    template: string,
    aiSuggestedName: string,
  ): string {
    // 支持多种 AI 变量格式
    const aiVariables = [
      "{ai}",
      "{AI}",
      "{desc}",
      "{description}",
      "{content}",
      "{name}",
      "{summary}",
      "{caption}",
      // 兼容旧格式
      "$" + "{ai文案}",
      "$" + "{ai}",
    ];

    let result = template;
    for (const variable of aiVariables) {
      result = result.replace(
        new RegExp(variable.replace(/[{}$]/g, "\\$&"), "g"),
        aiSuggestedName,
      );
    }

    return result;
  }

  /**
   * 提取文件日期
   * @param filePath - 文件路径
   * @param sources - 日期来源优先级
   * @returns 提取的日期
   */
  private static async extractFileDate(
    filePath: string,
    sources: ("exif" | "created" | "modified")[],
  ): Promise<Date> {
    for (const source of sources) {
      try {
        switch (source) {
          case "exif":
            if (FileUtils.isImageFile(filePath)) {
              const exifDate =
                await MetadataExtractor.extractCreationDate(filePath);
              if (exifDate) {
                progressLogger.debug(
                  `使用 EXIF 日期: ${exifDate.toISOString()}`,
                );
                return exifDate;
              }
            }
            break;
          case "created": {
            const fileInfo = FileUtils.getFileInfo(filePath);
            if (fileInfo?.createdAt) {
              progressLogger.debug(
                `使用创建日期: ${fileInfo.createdAt.toISOString()}`,
              );
              return fileInfo.createdAt;
            }
            break;
          }
          case "modified": {
            const modifiedInfo = FileUtils.getFileInfo(filePath);
            if (modifiedInfo?.modifiedAt) {
              progressLogger.debug(
                `使用修改日期: ${modifiedInfo.modifiedAt.toISOString()}`,
              );
              return modifiedInfo.modifiedAt;
            }
            break;
          }
        }
      } catch (error) {
        progressLogger.debug(`提取 ${source} 日期失败: ${error}`);
      }
    }

    // 如果都失败了，返回当前时间
    progressLogger.debug("使用当前时间作为默认日期");
    return new Date();
  }

  /**
   * 检查模板是否包含日期或时间占位符
   * @param template - 模板字符串
   * @returns 是否包含日期或时间占位符
   */
  private static hasDateTokens(template: string): boolean {
    // 检查常见的日期和时间格式
    return /YYYY|YY|MM|DD|HH|mm|ss|年|月|日|时|分|秒/g.test(template);
  }

  /**
   * 替换日期时间标记
   * @param template - 模板字符串
   * @param date - 日期对象
   * @returns 替换后的模板
   */
  private static replaceDateTokens(template: string, date: Date): string {
    const dayjsDate = dayjs(date);

    // 使用智能模式匹配，找出所有可能的日期时间格式并替换
    // 匹配 dayjs 支持的日期时间格式 token
    const dateTimePattern =
      /(?:YYYY|YY|MM|DD|HH|mm|ss|年|月|日|时|分|秒)+(?:[-_:：\s]*(?:YYYY|YY|MM|DD|HH|mm|ss|年|月|日|时|分|秒)*)*/g;

    return template.replace(dateTimePattern, (match) => {
      try {
        // 尝试用 dayjs 格式化这个匹配的部分
        const formatted = dayjsDate.format(match);
        return formatted;
      } catch {
        // 如果 dayjs 无法处理，返回原字符串
        return match;
      }
    });
  }

  /**
   * 验证模板格式
   * @param template - 模板字符串
   * @returns 验证结果
   */
  public static validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查是否包含 AI 变量
    const aiVariablePattern =
      /\{(ai|AI|desc|description|content|name|summary|caption)\}|\$\{(ai文案|ai)\}/g;

    if (!aiVariablePattern.test(template)) {
      warnings.push("模板中没有 AI 内容变量，建议添加 {ai} 或 {desc}");
    }

    // 检查日期时间格式
    if (TemplateResolver.hasDateTokens(template)) {
      warnings.push("检测到日期时间格式，建议启用日期时间替换功能");
    }

    // 检查非法字符
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(template)) {
      errors.push("模板包含非法字符，这些字符将被自动替换为下划线");
    }

    // 检查长度
    if (template.length > 200) {
      errors.push("模板过长，建议保持在 200 个字符以内");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取模板示例
   * @returns 模板示例列表
   */
  public static getTemplateExamples(): Array<{
    name: string;
    template: string;
    description: string;
  }> {
    return [
      {
        name: "自定义前缀",
        template: "2025-11_{ai}",
        description: "固定前缀 + AI 分析内容",
      },
      {
        name: "年月格式",
        template: "YYYY-MM_{ai}",
        description: "年月 + AI 分析内容",
      },
      {
        name: "完整日期",
        template: "YYYY-MM-DD_{ai}",
        description: "完整日期 + AI 分析内容",
      },
      {
        name: "中文日期",
        template: "YYYY年MM月DD日_{ai}",
        description: "中文日期格式 + AI 分析内容",
      },
      {
        name: "紧凑格式",
        template: "YYYYMMDD_{ai}",
        description: "紧凑日期格式 + AI 分析内容",
      },
      {
        name: "AI 内容在前",
        template: "{ai}_YYYY-MM-DD",
        description: "AI 分析内容 + 日期后缀",
      },
      {
        name: "纯 AI 内容",
        template: "{ai}",
        description: "直接使用 AI 分析的内容",
      },
      {
        name: "日期时间格式",
        template: "YYYY-MM-DD_HH-mm-ss_{ai}",
        description: "完整日期时间 + AI 分析内容",
      },
      {
        name: "中文日期时间",
        template: "YYYY年MM月DD日HH时mm分_{ai}",
        description: "中文日期时间格式 + AI 分析内容",
      },
      {
        name: "紧凑时间格式",
        template: "YYYYMMDD_HHmmss_{ai}",
        description: "紧凑日期时间格式 + AI 分析内容",
      },
      {
        name: "纯时间格式",
        template: "HH-mm-ss_{ai}",
        description: "仅时间格式 + AI 分析内容",
      },
    ];
  }
}
