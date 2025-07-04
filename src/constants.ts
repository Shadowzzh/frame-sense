/**
 * 媒体文件扩展名常量
 */

/** 视频文件扩展名 */
export const VIDEO_EXTENSIONS = [
  "mp4",
  "avi",
  "mov",
  "mkv",
  "wmv",
  "flv",
  "webm",
  "m4v",
  "3gp",
  "3g2",
  "f4v",
  "asf",
  "rm",
  "rmvb",
  "vob",
  "ogv",
  "drc",
  "gif",
  "gifv",
  "mng",
  "avi",
  "MTS",
  "M2TS",
  "TS",
] as const;

/** 图片文件扩展名 */
export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "tiff",
  "heic",
  "heif",
] as const;

/** 支持的扩展名（视频 + 图片） */
export const SUPPORTED_EXTENSIONS = [
  ...VIDEO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
] as const;

/** 支持的图片扩展名类型 */
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/** 支持的视频扩展名类型 */
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

/** 支持的所有扩展名类型 */
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
