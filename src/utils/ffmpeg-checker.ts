import { spawn } from "node:child_process";
import chalk from "chalk";

/**
 * FFmpeg 检查结果
 */
export interface FFmpegCheckResult {
  isAvailable: boolean;
  version?: string;
  error?: string;
}

/**
 * 检查 FFmpeg 是否可用
 * @returns FFmpeg 检查结果
 */
export async function checkFFmpeg(): Promise<FFmpegCheckResult> {
  try {
    const version = await getFFmpegVersion();
    return {
      isAvailable: true,
      version,
    };
  } catch (error) {
    return {
      isAvailable: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 检查 FFprobe 是否可用
 * @returns FFprobe 检查结果
 */
export async function checkFFprobe(): Promise<FFmpegCheckResult> {
  try {
    const version = await getFFprobeVersion();
    return {
      isAvailable: true,
      version,
    };
  } catch (error) {
    return {
      isAvailable: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 检查 FFmpeg 和 FFprobe 是否都可用
 * @returns 检查结果
 */
export async function checkFFmpegSuite(): Promise<{
  ffmpeg: FFmpegCheckResult;
  ffprobe: FFmpegCheckResult;
  allAvailable: boolean;
}> {
  const [ffmpeg, ffprobe] = await Promise.all([checkFFmpeg(), checkFFprobe()]);

  return {
    ffmpeg,
    ffprobe,
    allAvailable: ffmpeg.isAvailable && ffprobe.isAvailable,
  };
}

/**
 * 获取 FFmpeg 版本
 */
async function getFFmpegVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-version"]);

    let output = "";

    ffmpeg.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffmpeg.stderr.on("data", (_data) => {
      // FFmpeg 输出版本信息到 stderr，这是正常的
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg 版本检查失败，退出码: ${code}`));
        return;
      }

      // 解析版本信息
      const versionMatch = output.match(/ffmpeg version (\S+)/);
      if (versionMatch) {
        resolve(versionMatch[1]);
      } else {
        reject(new Error("无法解析 FFmpeg 版本"));
      }
    });

    ffmpeg.on("error", (error) => {
      if (error.message.includes("ENOENT")) {
        reject(new Error("FFmpeg 未找到，请确保已安装并在 PATH 中"));
      } else {
        reject(new Error(`FFmpeg 检查错误: ${error.message}`));
      }
    });
  });
}

/**
 * 获取 FFprobe 版本
 */
async function getFFprobeVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", ["-version"]);

    let output = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (_data) => {
      // FFprobe 输出版本信息到 stderr，这是正常的
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe 版本检查失败，退出码: ${code}`));
        return;
      }

      // 解析版本信息
      const versionMatch = output.match(/ffprobe version (\S+)/);
      if (versionMatch) {
        resolve(versionMatch[1]);
      } else {
        reject(new Error("无法解析 FFprobe 版本"));
      }
    });

    ffprobe.on("error", (error) => {
      if (error.message.includes("ENOENT")) {
        reject(new Error("FFprobe 未找到，请确保已安装并在 PATH 中"));
      } else {
        reject(new Error(`FFprobe 检查错误: ${error.message}`));
      }
    });
  });
}

/**
 * 显示 FFmpeg 错误提示
 * @param result 检查结果
 */
export function showFFmpegError(result: {
  ffmpeg: FFmpegCheckResult;
  ffprobe: FFmpegCheckResult;
  allAvailable: boolean;
}): void {
  console.log(chalk.red("✗ FFmpeg 依赖检查失败"));
  console.log();

  if (!result.ffmpeg.isAvailable) {
    console.log(chalk.red("  FFmpeg 不可用:"));
    console.log(chalk.gray(`    ${result.ffmpeg.error}`));
    console.log();
  }

  if (!result.ffprobe.isAvailable) {
    console.log(chalk.red("  FFprobe 不可用:"));
    console.log(chalk.gray(`    ${result.ffprobe.error}`));
    console.log();
  }

  console.log(chalk.yellow("安装说明:"));
  console.log();
  console.log(chalk.white("  macOS (使用 Homebrew):"));
  console.log(chalk.gray("    brew install ffmpeg"));
  console.log();
  console.log(chalk.white("  Ubuntu/Debian:"));
  console.log(chalk.gray("    sudo apt update"));
  console.log(chalk.gray("    sudo apt install ffmpeg"));
  console.log();
  console.log(chalk.white("  CentOS/RHEL/Fedora:"));
  console.log(chalk.gray("    sudo dnf install ffmpeg"));
  console.log();
  console.log(chalk.white("  Windows:"));
  console.log(chalk.gray("    从 https://ffmpeg.org/download.html 下载"));
  console.log(chalk.gray("    或使用 Chocolatey: choco install ffmpeg"));
  console.log();
}

/**
 * 显示 FFmpeg 检查成功信息
 * @param result 检查结果
 */
export function showFFmpegSuccess(result: {
  ffmpeg: FFmpegCheckResult;
  ffprobe: FFmpegCheckResult;
  allAvailable: boolean;
}): void {
  console.log(chalk.green("✓ FFmpeg 依赖检查通过"));
  console.log(chalk.gray(`  FFmpeg 版本: ${result.ffmpeg.version}`));
  console.log(chalk.gray(`  FFprobe 版本: ${result.ffprobe.version}`));
  console.log();
}
