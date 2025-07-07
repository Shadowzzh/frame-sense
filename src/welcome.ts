/**
 * CLI 欢迎信息工具
 */

import { logger } from "@/utils/logger";

/**
 * 显示欢迎信息
 */
export function showWelcome() {
  logger.raw("🎞️ Frame Sense");
  logger.raw("");
  logger.info("一个结合 FFmpeg 和 Google Gemini AI 的智能视频重命名工具");
  logger.raw("");
}
