/**
 * 文件扫描器
 */

import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { glob } from "glob";
import type { FrameSenseOptions } from "@/config";
import {
  IMAGE_EXTENSIONS,
  type ImageExtension,
  VIDEO_EXTENSIONS,
  type VideoExtension,
} from "@/constants";
import type { CategorizedFiles } from "@/types";

/**
 * 获取文件列表
 */
export async function getFileList(
  options: FrameSenseOptions & { directory?: string; files?: string[] },
): Promise<string[]> {
  const files: string[] = [];

  // 处理指定的文件列表
  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      // 检查文件是否存在且是文件
      if (existsSync(file) && statSync(file).isFile()) {
        files.push(file);
      }
    }
  }

  // 处理指定的目录
  if (options.directory) {
    if (!existsSync(options.directory)) {
      throw new Error(`目录不存在: ${options.directory}`);
    }

    if (!statSync(options.directory).isDirectory()) {
      throw new Error(`路径不是目录: ${options.directory}`);
    }

    const patterns = [
      ...VIDEO_EXTENSIONS.map((ext) => `**/*${ext}`),
      ...IMAGE_EXTENSIONS.map((ext) => `**/*${ext}`),
    ];

    for (const pattern of patterns) {
      const matchedFiles = await glob(pattern, {
        cwd: options.directory,
        absolute: true,
        nodir: true,
      });
      files.push(...matchedFiles);
    }
  }

  // 去重并排序
  return [...new Set(files)].sort();
}

/**
 * 按文件类型分类
 */
export function categorizeFiles(files: string[]): CategorizedFiles {
  const imageFiles: string[] = [];
  const videoFiles: string[] = [];

  for (const file of files) {
    const fileExtension = extname(file).toLowerCase().slice(1); // 去掉开头的 .
    if (IMAGE_EXTENSIONS.includes(fileExtension as ImageExtension)) {
      imageFiles.push(file);
    } else if (VIDEO_EXTENSIONS.includes(fileExtension as VideoExtension)) {
      videoFiles.push(file);
    }
  }

  return { imageFiles, videoFiles };
}
