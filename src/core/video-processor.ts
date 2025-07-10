/**
 * 视频处理器
 * 使用 FFmpeg 提取视频关键帧，支持多种提取策略
 */

import { execSync, spawn } from "node:child_process";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { getConfigManager } from "@/core/config";
import type {
  CleanupFunction,
  DependencyCheckResult,
  FrameExtractionStrategy,
  VideoFrameInfo,
} from "@/types";
import { FileUtils } from "@/utils/file-utils";
import { getSignalHandler } from "@/utils/signal-handler";

export class VideoProcessor {
  /** 默认提取帧数 */
  private static readonly DEFAULT_FRAME_COUNT = 5;
  /** 默认帧位置（单帧模式） */
  private static readonly DEFAULT_FRAME_POSITION = 10;
  /** 临时文件清理列表 */
  private tempFiles: string[] = [];
  /** 清理函数 */
  private cleanupFunction: CleanupFunction;

  constructor() {
    // 注册清理函数到信号处理器
    this.cleanupFunction = this.cleanup.bind(this);
    getSignalHandler().addCleanupFunction(this.cleanupFunction);
  }

  /**
   * 检查 FFmpeg 和 FFprobe 依赖
   * @returns 依赖检查结果
   */
  public static checkDependencies(): {
    ffmpeg: DependencyCheckResult;
    ffprobe: DependencyCheckResult;
  } {
    return {
      ffmpeg: VideoProcessor.checkCommand("ffmpeg"),
      ffprobe: VideoProcessor.checkCommand("ffprobe"),
    };
  }

  /**
   * 检查单个命令是否可用
   * @param command - 命令名称
   * @returns 检查结果
   */
  private static checkCommand(command: string): DependencyCheckResult {
    try {
      // 尝试获取版本信息
      const output = execSync(`${command} -version`, {
        encoding: "utf8",
        timeout: 5000,
        stdio: "pipe",
      });

      // 解析版本信息
      const versionMatch = output.match(/version\s+([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : "unknown";

      return {
        available: true,
        version,
        path: command,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 获取视频基本信息
   * @param videoPath - 视频文件路径
   * @returns 视频信息
   */
  private async getVideoInfo(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
  }> {
    return new Promise((resolve, reject) => {
      const command = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-select_streams",
        "v:0",
        videoPath,
      ];

      const ffprobe = spawn(command[0], command.slice(1));
      let output = "";
      let error = "";

      ffprobe.stdout.on("data", (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        error += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe 执行失败: ${error}`));
          return;
        }

        try {
          const info = JSON.parse(output);
          const videoStream = info.streams.find(
            (s: {
              codec_type?: string;
              width?: string | number;
              height?: string | number;
              r_frame_rate?: string;
            }) => s.codec_type === "video",
          );

          if (!videoStream) {
            reject(new Error("未找到视频流"));
            return;
          }

          resolve({
            duration: parseFloat(info.format.duration) || 0,
            width: parseInt(videoStream.width) || 0,
            height: parseInt(videoStream.height) || 0,
            fps: this.parseFps(videoStream.r_frame_rate) || 25,
          });
        } catch (parseError) {
          reject(new Error(`解析视频信息失败: ${parseError}`));
        }
      });

      ffprobe.on("error", (err) => {
        reject(new Error(`FFprobe 启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 解析帧率字符串
   * @param fpsString - 帧率字符串（如 "25/1"）
   * @returns 帧率数值
   */
  private parseFps(fpsString: string): number {
    try {
      if (fpsString.includes("/")) {
        const [numerator, denominator] = fpsString.split("/").map(Number);
        return numerator / denominator;
      }
      return parseFloat(fpsString);
    } catch {
      return 25; // 默认帧率
    }
  }

  /**
   * 提取视频帧
   * @param videoPath - 视频文件路径
   * @param strategy - 提取策略
   * @returns 视频帧信息
   */
  public async extractFrames(
    videoPath: string,
    strategy?: FrameExtractionStrategy,
  ): Promise<VideoFrameInfo> {
    // 检查依赖
    const deps = VideoProcessor.checkDependencies();
    if (!deps.ffmpeg.available) {
      throw new Error(`FFmpeg 不可用: ${deps.ffmpeg.error}`);
    }
    if (!deps.ffprobe.available) {
      throw new Error(`FFprobe 不可用: ${deps.ffprobe.error}`);
    }

    // 检查视频文件
    if (!FileUtils.fileExists(videoPath)) {
      throw new Error(`视频文件不存在: ${videoPath}`);
    }

    if (!FileUtils.isVideoFile(videoPath)) {
      throw new Error(`不是有效的视频文件: ${videoPath}`);
    }

    // 获取配置
    const config = getConfigManager();
    const extractionStrategy = strategy || config.getFrameExtractionStrategy();

    // 获取视频信息
    const videoInfo = await this.getVideoInfo(videoPath);

    // 创建临时目录
    const tempDir = FileUtils.getTempDir();
    const framePaths: string[] = [];

    try {
      // 根据策略提取帧
      switch (extractionStrategy) {
        case "single":
          framePaths.push(
            ...(await this.extractSingleFrame(videoPath, tempDir, videoInfo)),
          );
          break;
        case "multiple":
          framePaths.push(
            ...(await this.extractMultipleFrames(
              videoPath,
              tempDir,
              videoInfo,
            )),
          );
          break;
        case "keyframes":
          framePaths.push(...(await this.extractKeyFrames(videoPath, tempDir)));
          break;
        default:
          throw new Error(`不支持的提取策略: ${extractionStrategy}`);
      }

      // 添加到临时文件列表
      this.tempFiles.push(...framePaths);

      return {
        videoPath,
        framePaths,
        duration: videoInfo.duration,
        width: videoInfo.width,
        height: videoInfo.height,
        fps: videoInfo.fps,
        strategy: extractionStrategy,
      };
    } catch (error) {
      // 清理已创建的临时文件
      this.cleanupTempFiles(framePaths);
      throw error;
    }
  }

  /**
   * 提取单帧（第10帧）
   * @param videoPath - 视频路径
   * @param tempDir - 临时目录
   * @param videoInfo - 视频信息
   * @returns 帧文件路径列表
   */
  private async extractSingleFrame(
    videoPath: string,
    tempDir: string,
    videoInfo: { duration: number; fps: number },
  ): Promise<string[]> {
    const frameTime = Math.min(
      VideoProcessor.DEFAULT_FRAME_POSITION / videoInfo.fps,
      videoInfo.duration - 1,
    );

    const outputPath = join(tempDir, `frame_${Date.now()}.jpg`);

    await this.runFFmpeg([
      "-i",
      videoPath,
      "-ss",
      frameTime.toString(),
      "-vframes",
      "1",
      "-y",
      outputPath,
    ]);

    return [outputPath];
  }

  /**
   * 提取多帧（均匀分布）
   * @param videoPath - 视频路径
   * @param tempDir - 临时目录
   * @param videoInfo - 视频信息
   * @returns 帧文件路径列表
   */
  private async extractMultipleFrames(
    videoPath: string,
    tempDir: string,
    videoInfo: { duration: number },
  ): Promise<string[]> {
    /** 取帧数 */
    const frameCount = VideoProcessor.DEFAULT_FRAME_COUNT;
    /** 帧间隔 */
    const interval = videoInfo.duration / (frameCount + 1);
    /** 帧文件路径列表 */
    const framePaths: string[] = [];

    for (let i = 1; i <= frameCount; i++) {
      const frameTime = interval * i;
      const outputPath = join(tempDir, `frame_${Date.now()}_${i}.jpg`);

      await this.runFFmpeg([
        "-i",
        videoPath,
        "-ss",
        frameTime.toString(),
        "-vframes",
        "1",
        "-y",
        outputPath,
      ]);

      framePaths.push(outputPath);
    }

    return framePaths;
  }

  /**
   * 提取关键帧
   * @param videoPath - 视频路径
   * @param tempDir - 临时目录
   * @returns 帧文件路径列表
   */
  private async extractKeyFrames(
    videoPath: string,
    tempDir: string,
  ): Promise<string[]> {
    const outputPattern = join(tempDir, `keyframe_${Date.now()}_%03d.jpg`);

    await this.runFFmpeg([
      "-i",
      videoPath,
      "-vf",
      "select=eq(pict_type\\,I)",
      "-vsync",
      "vfr",
      "-y",
      outputPattern,
    ]);

    // 获取生成的关键帧文件
    const framePaths: string[] = [];
    const files = require("node:fs").readdirSync(tempDir);

    for (const file of files) {
      if (file.startsWith(`keyframe_${Date.now().toString().slice(0, -3)}`)) {
        framePaths.push(join(tempDir, file));
      }
    }

    return framePaths;
  }

  /**
   * 执行 FFmpeg 命令
   * @param args - 命令参数
   * @returns Promise
   */
  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const config = getConfigManager();

      if (config.isVerboseMode()) {
        console.log("FFmpeg 命令:", "ffmpeg", args.join(" "));
      }

      const ffmpeg = spawn("ffmpeg", args);
      let error = "";

      ffmpeg.stderr.on("data", (data) => {
        error += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg 执行失败 (退出码: ${code}): ${error}`));
          return;
        }
        resolve();
      });

      ffmpeg.on("error", (err) => {
        reject(new Error(`FFmpeg 启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 清理临时文件
   * @param filePaths - 要清理的文件路径列表
   */
  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (FileUtils.fileExists(filePath)) {
          unlinkSync(filePath);
        }
      } catch (error) {
        if (getConfigManager().isVerboseMode()) {
          console.warn(`清理临时文件失败 ${filePath}:`, error);
        }
      }
    }
  }

  /**
   * 清理所有临时文件
   */
  public cleanup(): void {
    this.cleanupTempFiles(this.tempFiles);
    this.tempFiles = [];
  }

  /**
   * 销毁处理器
   */
  public destroy(): void {
    // 从信号处理器中移除清理函数
    getSignalHandler().removeCleanupFunction(this.cleanupFunction);
    this.cleanup();
  }

  /**
   * 获取支持的视频格式
   * @returns 支持的视频格式列表
   */
  public static getSupportedFormats(): string[] {
    return FileUtils.getSupportedFormats().videos;
  }

  /**
   * 批量处理视频文件
   * @param videoPaths - 视频文件路径列表
   * @param strategy - 提取策略
   * @param onProgress - 进度回调
   * @returns 处理结果列表
   */
  public async batchExtractFrames(
    videoPaths: string[],
    strategy?: FrameExtractionStrategy,
    onProgress?: (current: number, total: number, currentFile: string) => void,
  ): Promise<VideoFrameInfo[]> {
    const results: VideoFrameInfo[] = [];
    const total = videoPaths.length;

    for (let i = 0; i < videoPaths.length; i++) {
      const videoPath = videoPaths[i];

      if (onProgress) {
        onProgress(i + 1, total, videoPath);
      }

      try {
        const frameInfo = await this.extractFrames(videoPath, strategy);
        results.push(frameInfo);
      } catch (error) {
        console.error(`处理视频文件失败 ${videoPath}:`, error);
        // 继续处理其他文件，不中断整个批量处理
      }
    }

    return results;
  }
}
