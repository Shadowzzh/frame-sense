/**
 * 元数据提取器
 * 从图像文件中提取 EXIF 数据和创建时间
 */

import { readFile } from "node:fs/promises";
import type { ExifData } from "exif";
import { FileUtils } from "@/utils/file-utils";
import { progressLogger } from "@/utils/progress-logger";

export class MetadataExtractor {
  /**
   * 从图片 EXIF 数据提取创建日期
   * @param filePath - 图片文件路径
   * @returns 创建日期或 null
   */
  public static async extractCreationDate(
    filePath: string,
  ): Promise<Date | null> {
    try {
      if (!FileUtils.isImageFile(filePath)) {
        return null;
      }

      const exifData = await MetadataExtractor.extractExifData(filePath);

      if (!exifData) {
        return null;
      }

      // 尝试多个 EXIF 日期字段
      const dateFields = [
        exifData.exif?.DateTimeOriginal,
        (exifData.exif as Record<string, string>)?.DateTime,
        (exifData.exif as Record<string, string>)?.DateTimeDigitized,
      ];

      for (const dateField of dateFields) {
        if (dateField) {
          const date = MetadataExtractor.parseExifDate(dateField);
          if (date) {
            return date;
          }
        }
      }

      return null;
    } catch (error) {
      progressLogger.debug(`提取 EXIF 日期失败: ${filePath}, ${error}`);
      return null;
    }
  }

  /**
   * 提取 EXIF 数据
   * @param filePath - 图片文件路径
   * @returns EXIF 数据或 null
   */
  public static async extractExifData(
    filePath: string,
  ): Promise<ExifData | null> {
    try {
      const buffer = await readFile(filePath);

      return new Promise((resolve, _reject) => {
        // 使用动态导入以避免构建时的模块问题
        import("exif")
          .then(({ ExifImage }) => {
            try {
              new ExifImage({ image: buffer }, (error, exifData) => {
                if (error) {
                  resolve(null);
                } else {
                  resolve(exifData);
                }
              });
            } catch (_error) {
              resolve(null);
            }
          })
          .catch(() => {
            resolve(null);
          });
      });
    } catch (error) {
      progressLogger.debug(`读取 EXIF 数据失败: ${filePath}, ${error}`);
      return null;
    }
  }

  /**
   * 解析 EXIF 日期格式
   * @param exifDateString - EXIF 日期字符串
   * @returns 解析后的日期或 null
   */
  private static parseExifDate(exifDateString: string): Date | null {
    try {
      // EXIF 日期格式: "YYYY:MM:DD HH:mm:ss"
      const [datePart, timePart = "00:00:00"] = exifDateString.split(" ");
      const [year, month, day] = datePart.split(":").map(Number);
      const [hour, minute, second] = timePart.split(":").map(Number);

      // 验证日期有效性
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
        return null;
      }

      // 月份从 0 开始计数
      const date = new Date(
        year,
        month - 1,
        day,
        hour || 0,
        minute || 0,
        second || 0,
      );

      // 验证日期是否有效
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }

      return date;
    } catch (error) {
      progressLogger.debug(`解析 EXIF 日期失败: ${exifDateString}, ${error}`);
      return null;
    }
  }

  /**
   * 提取图片的基本信息
   * @param filePath - 图片文件路径
   * @returns 图片信息
   */
  public static async extractImageInfo(filePath: string): Promise<{
    width?: number;
    height?: number;
    camera?: string;
    lens?: string;
    creationDate?: Date;
  } | null> {
    try {
      const exifData = await MetadataExtractor.extractExifData(filePath);

      if (!exifData) {
        return null;
      }

      const info: {
        width?: number;
        height?: number;
        camera?: string;
        lens?: string;
        creationDate?: Date;
      } = {};

      // 提取尺寸信息
      if (exifData.exif?.ExifImageWidth) {
        info.width = exifData.exif.ExifImageWidth;
      }
      if (exifData.exif?.ExifImageHeight) {
        info.height = exifData.exif.ExifImageHeight;
      }

      // 提取相机信息
      if (exifData.image?.Make && exifData.image?.Model) {
        info.camera = `${exifData.image.Make} ${exifData.image.Model}`;
      }

      // 提取镜头信息
      if (exifData.exif?.LensModel) {
        info.lens = exifData.exif.LensModel;
      }

      // 提取创建日期
      const creationDate =
        await MetadataExtractor.extractCreationDate(filePath);
      if (creationDate) {
        info.creationDate = creationDate;
      }

      return info;
    } catch (error) {
      progressLogger.debug(`提取图片信息失败: ${filePath}, ${error}`);
      return null;
    }
  }

  /**
   * 检查文件是否包含 EXIF 数据
   * @param filePath - 文件路径
   * @returns 是否包含 EXIF 数据
   */
  public static async hasExifData(filePath: string): Promise<boolean> {
    try {
      const exifData = await MetadataExtractor.extractExifData(filePath);
      return (
        exifData !== null && !!(exifData.exif || exifData.image || exifData.gps)
      );
    } catch (_error) {
      return false;
    }
  }
}
