/**
 * 文件工具类
 * 提供文件操作、媒体文件识别、路径处理等功能
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import type {
  ImageFormat,
  MediaFileInfo,
  MediaFileType,
  VideoFormat,
} from "@/types";

export class FileUtils {
  /** 支持的图像格式 */
  private static readonly IMAGE_FORMATS: ImageFormat[] = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tiff",
    "svg",
  ];

  /** 支持的视频格式 */
  private static readonly VIDEO_FORMATS: VideoFormat[] = [
    "mp4",
    "avi",
    "mov",
    "mkv",
    "flv",
    "wmv",
    "webm",
    "m4v",
    "3gp",
  ];

  /** 最大文件名长度 */
  private static readonly MAX_FILENAME_LENGTH = 255;

  /** 非法文件名字符正则表达式 */
  private static readonly INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

  /**
   * 检查文件是否存在
   * @param filePath - 文件路径
   * @returns 是否存在
   */
  public static fileExists(filePath: string): boolean {
    try {
      return existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 检查路径是否为目录
   * @param dirPath - 目录路径
   * @returns 是否为目录
   */
  public static isDirectory(dirPath: string): boolean {
    try {
      if (!FileUtils.fileExists(dirPath)) {
        return false;
      }
      return statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 获取文件信息
   * @param filePath - 文件路径
   * @returns 文件信息或 null
   */
  public static getFileInfo(filePath: string) {
    try {
      if (!FileUtils.fileExists(filePath)) {
        return null;
      }

      const stats = statSync(filePath);
      const name = basename(filePath);
      const extension = extname(filePath).toLowerCase().slice(1);
      const type = FileUtils.getFileType(extension);

      if (!type) {
        return null;
      }

      return {
        path: resolve(filePath),
        name,
        extension,
        size: stats.size,
        type,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * 根据扩展名获取文件类型
   * @param extension - 文件扩展名
   * @returns 文件类型或 null
   */
  public static getFileType(extension: string): MediaFileType | null {
    const ext = extension.toLowerCase();

    if (FileUtils.IMAGE_FORMATS.includes(ext as ImageFormat)) {
      return "image";
    }

    if (FileUtils.VIDEO_FORMATS.includes(ext as VideoFormat)) {
      return "video";
    }

    return null;
  }

  /**
   * 检查是否为图像文件
   * @param filePath - 文件路径
   * @returns 是否为图像文件
   */
  public static isImageFile(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase().slice(1);
    return FileUtils.IMAGE_FORMATS.includes(extension as ImageFormat);
  }

  /**
   * 检查是否为视频文件
   * @param filePath - 文件路径
   * @returns 是否为视频文件
   */
  public static isVideoFile(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase().slice(1);
    return FileUtils.VIDEO_FORMATS.includes(extension as VideoFormat);
  }

  /**
   * 检查是否为媒体文件
   * @param filePath - 文件路径
   * @returns 是否为媒体文件
   */
  public static isMediaFile(filePath: string): boolean {
    return FileUtils.isImageFile(filePath) || FileUtils.isVideoFile(filePath);
  }

  /**
   * 获取目录中的所有媒体文件
   * @param dirPath - 目录路径
   * @param recursive - 是否递归搜索（默认不递归）
   * @returns 媒体文件信息列表
   */
  public static getMediaFiles(
    dirPath: string,
    recursive = false,
  ): MediaFileInfo[] {
    const mediaFiles: MediaFileInfo[] = [];

    try {
      if (!FileUtils.fileExists(dirPath)) {
        return mediaFiles;
      }

      const files = readdirSync(dirPath);

      for (const file of files) {
        const filePath = join(dirPath, file);
        const stats = statSync(filePath);

        if (stats.isDirectory() && recursive) {
          // 递归搜索子目录
          mediaFiles.push(...FileUtils.getMediaFiles(filePath, true));
        } else if (stats.isFile() && FileUtils.isMediaFile(filePath)) {
          // 添加媒体文件
          const fileInfo = FileUtils.getFileInfo(filePath);
          if (fileInfo) {
            mediaFiles.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.error(`读取目录失败 ${dirPath}:`, error);
    }

    return mediaFiles;
  }

  /**
   * 清理文件名，移除非法字符
   * @param filename - 原始文件名
   * @returns 清理后的文件名
   */
  public static sanitizeFilename(filename: string): string {
    let sanitized = filename
      .replace(FileUtils.INVALID_FILENAME_CHARS, "_") // 替换非法字符
      .replace(/\s+/g, "_") // 替换空格
      .replace(/_{2,}/g, "_") // 合并连续下划线
      .replace(/^_|_$/g, "") // 移除首尾下划线
      .trim();

    // 限制文件名长度
    if (sanitized.length > FileUtils.MAX_FILENAME_LENGTH) {
      sanitized = sanitized.substring(0, FileUtils.MAX_FILENAME_LENGTH);
    }

    // 确保文件名不为空
    if (!sanitized) {
      sanitized = "unnamed";
    }

    return sanitized;
  }

  /**
   * 生成唯一的文件名，避免冲突
   * @param dirPath - 目录路径
   * @param filename - 原始文件名
   * @param extension - 文件扩展名
   * @returns 唯一的文件名
   */
  public static generateUniqueFilename(
    dirPath: string,
    filename: string,
    extension: string,
  ): string {
    const sanitizedName = FileUtils.sanitizeFilename(filename);
    let uniqueName = sanitizedName;
    let counter = 1;

    // 检查文件名是否已存在，如果存在则添加数字后缀
    while (FileUtils.fileExists(join(dirPath, `${uniqueName}.${extension}`))) {
      uniqueName = `${sanitizedName}_${counter}`;
      counter++;
    }

    return uniqueName;
  }

  /**
   * 安全地复制文件
   * @param sourcePath - 源文件路径
   * @param targetPath - 目标文件路径
   * @returns 是否成功
   */
  public static copyFile(sourcePath: string, targetPath: string): boolean {
    try {
      if (!FileUtils.fileExists(sourcePath)) {
        return false;
      }

      // 确保目标目录存在
      const targetDir = dirname(targetPath);
      if (!FileUtils.fileExists(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // 如果目标文件已存在，生成唯一名称
      if (FileUtils.fileExists(targetPath)) {
        const dir = dirname(targetPath);
        const name = basename(targetPath, extname(targetPath));
        const ext = extname(targetPath).slice(1);
        const uniqueName = FileUtils.generateUniqueFilename(dir, name, ext);
        targetPath = join(dir, `${uniqueName}.${ext}`);
      }

      copyFileSync(sourcePath, targetPath);
      return true;
    } catch (error) {
      console.error(`复制文件失败 ${sourcePath} -> ${targetPath}:`, error);
      return false;
    }
  }

  /**
   * 安全地重命名文件
   * @param oldPath - 原始文件路径
   * @param newPath - 新文件路径
   * @returns 是否成功
   */
  public static renameFile(oldPath: string, newPath: string): boolean {
    try {
      if (!FileUtils.fileExists(oldPath)) {
        return false;
      }

      // 确保目标目录存在
      const targetDir = dirname(newPath);
      if (!FileUtils.fileExists(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // 如果目标文件已存在，生成唯一名称
      if (FileUtils.fileExists(newPath)) {
        const dir = dirname(newPath);
        const name = basename(newPath, extname(newPath));
        const ext = extname(newPath).slice(1);
        const uniqueName = FileUtils.generateUniqueFilename(dir, name, ext);
        newPath = join(dir, `${uniqueName}.${ext}`);
      }

      renameSync(oldPath, newPath);
      return true;
    } catch (error) {
      console.error(`重命名文件失败 ${oldPath} -> ${newPath}:`, error);
      return false;
    }
  }

  /**
   * 获取临时目录路径
   * @param subDir - 子目录名称
   * @returns 临时目录路径
   */
  public static getTempDir(subDir = "frame-sense"): string {
    const tempPath = join(tmpdir(), subDir);

    try {
      if (!FileUtils.fileExists(tempPath)) {
        mkdirSync(tempPath, { recursive: true });
      }
    } catch (error) {
      console.error(`创建临时目录失败 ${tempPath}:`, error);
    }

    return tempPath;
  }

  /**
   * 计算 Base64 编码后的字节大小
   * @param input
   * @returns
   */
  public static base64EncodedSize(input: string) {
    const buffer = Buffer.from(input);
    const bytes = Math.ceil(buffer.length / 3) * 4;
    return bytes;
  }

  /**
   * 格式化文件大小
   * @param bytes - 字节数
   * @returns 格式化后的大小字符串
   */
  public static formatFileSize(bytes: number) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  }

  /**
   * 获取支持的格式信息
   * @returns 支持的格式列表
   */
  public static getSupportedFormats(): {
    images: ImageFormat[];
    videos: VideoFormat[];
  } {
    return {
      images: [...FileUtils.IMAGE_FORMATS],
      videos: [...FileUtils.VIDEO_FORMATS],
    };
  }

  /**
   * 获取文件扩展名（不包含点）
   * @param filePath - 文件路径
   * @returns 文件扩展名
   */
  public static getFileExtension(filePath: string): string {
    return extname(filePath).toLowerCase().slice(1);
  }

  /**
   * 获取不带扩展名的文件名
   * @param filePath - 文件路径
   * @returns 不带扩展名的文件名
   */
  public static getFileNameWithoutExtension(filePath: string): string {
    return basename(filePath, extname(filePath));
  }
}
