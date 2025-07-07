import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import type { FrameSenseOptions } from "@/config";
import { checkFFmpegSuite } from "@/utils/ffmpeg-checker";
import { logger } from "@/utils/logger";

/**
 * 帧提取器
 */
export class FrameExtractor {
  private tempDir: string;
  private createdDirs: Set<string> = new Set();
  private options?: FrameSenseOptions;

  constructor(options?: FrameSenseOptions) {
    this.options = options;
    // 临时目录
    this.tempDir = join(tmpdir(), "frame-sense");
  }

  /**
   * 提取帧
   * @param videoPath 视频路径
   * @param frameCount 帧数
   * @returns 帧路径
   */
  async extractFrames(videoPath: string, frameCount = 2): Promise<string[]> {
    // 检查 FFmpeg 依赖
    const ffmpegCheck = await checkFFmpegSuite();
    if (!ffmpegCheck.allAvailable) {
      throw new Error("FFmpeg 或 FFprobe 不可用，无法提取视频帧");
    }

    if (this.options?.verbose) {
      logger.verbose(`🎬 开始提取视频帧: ${videoPath}`);
      logger.verbose(`🎯 提取帧数: ${frameCount}`);
    }

    await this.ensureTempDir();

    // 视频文件名
    const videoName = basename(videoPath, extname(videoPath));
    // 临时帧目录
    const frameDir = join(this.tempDir, randomUUID());

    if (this.options?.verbose) {
      logger.verbose(`📁 临时目录: ${frameDir}`);
    }

    // 创建临时帧目录
    await fs.mkdir(frameDir, { recursive: true });
    this.createdDirs.add(frameDir);

    try {
      // 获取视频时长
      const duration = await this.getVideoDuration(videoPath);

      if (this.options?.verbose) {
        logger.verbose(`⏱️  视频时长: ${duration.toFixed(2)} 秒`);
      }

      // 计算关键帧时间点
      const timePoints = this.calculateTimePoints(duration, frameCount);

      if (this.options?.verbose) {
        logger.verbose(
          `📍 帧时间点: ${timePoints.map((t) => t.toFixed(2)).join(", ")} 秒`,
        );
      }

      // 提取关键帧
      const framePaths: string[] = [];

      for (let i = 0; i < timePoints.length; i++) {
        // 帧路径
        const framePath = join(frameDir, `${videoName}_frame_${i + 1}.jpg`);
        // 时间点
        const timePoint = timePoints[i];
        // 提取帧
        if (timePoint !== undefined) {
          if (this.options?.verbose) {
            logger.verbose(`🎞️  提取第 ${i + 1} 帧 (${timePoint.toFixed(2)}s)`);
          }
          await this.extractFrameAtTime(videoPath, timePoint, framePath);
          framePaths.push(framePath);
        }
      }

      if (this.options?.verbose) {
        logger.verbose(`✅ 帧提取完成，共 ${framePaths.length} 帧`);
      }

      return framePaths;
    } catch (error) {
      // 清理临时目录
      await fs.rm(frameDir, { recursive: true, force: true });
      this.createdDirs.delete(frameDir);
      throw error;
    }
  }

  /**
   * 清理帧
   * @param framePaths 帧路径
   */
  async cleanupFrames(framePaths: string[]): Promise<void> {
    for (const framePath of framePaths) {
      try {
        await fs.unlink(framePath);
      } catch {
        // 忽略清理错误
      }
    }

    // 尝试清理父目录
    if (framePaths.length > 0) {
      const frameDir = dirname(framePaths[0]);
      try {
        await fs.rmdir(frameDir);
        this.createdDirs.delete(frameDir);
      } catch {
        // 忽略清理错误
      }
    }
  }

  /**
   * 清理所有临时目录
   */
  async cleanup(): Promise<void> {
    for (const dir of this.createdDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
    this.createdDirs.clear();

    // 尝试清理主临时目录
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 确保临时目录存在
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch {
      // 目录已存在，忽略错误
    }
  }

  /**
   * 获取视频时长
   * @param videoPath 视频路径
   * @returns 视频时长
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // 使用 ffprobe 获取视频时长
      const ffprobe = spawn("ffprobe", [
        "-v",
        "quiet",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        videoPath,
      ]);

      let output = "";

      ffprobe.stdout.on("data", (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        logger.error(`ffprobe stderr: ${data}`);
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe 执行失败，退出码: ${code}`));
          return;
        }

        const duration = Number.parseFloat(output.trim());

        if (Number.isNaN(duration)) {
          reject(new Error("无法解析视频时长"));
          return;
        }

        resolve(duration);
      });

      ffprobe.on("error", (error) => {
        reject(new Error(`ffprobe 执行错误: ${error.message}`));
      });
    });
  }

  /**
   * 计算时间点
   * @param duration 视频时长
   * @param frameCount 帧数
   * @returns 时间点
   */
  private calculateTimePoints(duration: number, frameCount: number): number[] {
    const timePoints: number[] = [];

    if (frameCount === 1) {
      // 单帧：选择视频中点
      timePoints.push(duration / 2);
    } else {
      // 多帧：均匀分布，避免开头和结尾
      const margin = duration * 0.1; // 10% 边距
      const usableDuration = duration - 2 * margin;
      const interval = usableDuration / (frameCount - 1);

      for (let i = 0; i < frameCount; i++) {
        timePoints.push(margin + i * interval);
      }
    }

    return timePoints;
  }

  /**
   * 提取帧
   * @param videoPath 视频路径
   * @param time 时间点
   * @param outputPath 输出路径
   */
  private async extractFrameAtTime(
    videoPath: string,
    time: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        videoPath,
        "-ss",
        time.toString(),
        "-vframes",
        "1",
        "-q:v",
        "2",
        "-y",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", (_data) => {
        // ffmpeg 输出大量信息到 stderr，这是正常的
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg 执行失败，退出码: ${code}`));
          return;
        }

        resolve();
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`ffmpeg 执行错误: ${error.message}`));
      });
    });
  }
}
