/**
 * 统一的进度和日志管理器
 * 解决 ora spinner 被 console.log 打断的问题
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import ora, { type Ora } from "ora";

export interface ProgressEvent {
  stage: string;
  current: number;
  total: number;
  percentage: number;
  details?: string;
}

export interface LogMessage {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: Date;
}

export class ProgressLogger extends EventEmitter {
  private spinner: Ora | null = null;
  private logBuffer: LogMessage[] = [];
  private isSpinnerActive = false;
  private verboseMode = false;

  constructor(verboseMode = false) {
    super();
    this.verboseMode = verboseMode;
  }

  /**
   * 开始进度指示器
   */
  public startProgress(text: string): void {
    this.stopProgress();
    this.spinner = ora({
      text,
      color: "green",
    }).start();
    this.isSpinnerActive = true;
  }

  /**
   * 更新进度
   */
  public updateProgress(text: string, progress?: ProgressEvent): void {
    if (this.spinner) {
      let displayText = text;
      if (progress) {
        displayText = `${text} (${progress.current}/${progress.total} - ${progress.percentage}%)`;
      }
      this.spinner.text = displayText;
    }

    if (progress) {
      this.emit("progress", progress);
    }
  }

  /**
   * 成功结束进度
   */
  public succeedProgress(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
    this.isSpinnerActive = false;
    this.flushLogBuffer();
  }

  /**
   * 失败结束进度
   */
  public failProgress(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
    this.isSpinnerActive = false;
    this.flushLogBuffer();
  }

  /**
   * 停止进度指示器
   */
  public stopProgress(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    this.isSpinnerActive = false;
    this.flushLogBuffer();
  }

  /**
   * 智能日志输出 - 如果有 spinner 运行则缓存，否则直接输出
   */
  public log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
  ): void {
    const logMessage: LogMessage = {
      level,
      message,
      timestamp: new Date(),
    };

    if (this.isSpinnerActive) {
      // 如果 spinner 正在运行，缓存日志
      this.logBuffer.push(logMessage);
    } else {
      // 直接输出
      this.outputLog(logMessage);
    }
  }

  /**
   * 便捷的日志方法
   */
  public info(message: string): void {
    this.log("info", message);
  }

  public warn(message: string): void {
    this.log("warn", message);
  }

  public error(message: string): void {
    this.log("error", message);
  }

  public debug(message: string): void {
    if (this.verboseMode) {
      this.log("debug", message);
    }
  }

  /**
   * 刷新日志缓冲区
   */
  private flushLogBuffer(): void {
    if (this.logBuffer.length > 0) {
      for (const logMessage of this.logBuffer) {
        this.outputLog(logMessage);
      }
      this.logBuffer = [];
    }
  }

  /**
   * 输出日志到控制台
   */
  private outputLog(logMessage: LogMessage): void {
    const { level, message } = logMessage;

    switch (level) {
      case "info":
        console.log(chalk.blue("ℹ"), message);
        break;
      case "warn":
        console.log(chalk.yellow("⚠"), message);
        break;
      case "error":
        console.log(chalk.red("✖"), message);
        break;
      case "debug":
        if (this.verboseMode) {
          console.log(chalk.gray("🔍"), chalk.gray(message));
        }
        break;
    }
  }

  /**
   * 临时暂停 spinner 输出一条重要消息
   */
  public pauseAndLog(level: "info" | "warn" | "error", message: string): void {
    const wasActive = this.isSpinnerActive;
    const currentText = this.spinner?.text;

    if (wasActive) {
      this.spinner?.stop();
    }

    this.outputLog({
      level,
      message,
      timestamp: new Date(),
    });

    if (wasActive && currentText) {
      this.spinner = ora({
        text: currentText,
        color: "cyan",
      }).start();
    }
  }

  /**
   * 批量操作的进度管理
   */
  public createBatchProgress(totalItems: number, stageName: string) {
    let currentItem = 0;

    return {
      start: () => {
        this.startProgress(`${stageName} (0/${totalItems})`);
      },

      next: (itemName?: string) => {
        currentItem++;
        const percentage = Math.round((currentItem / totalItems) * 100);
        const details = itemName ? ` - ${itemName}` : "";
        this.updateProgress(
          `${stageName} (${currentItem}/${totalItems})${details}`,
          {
            stage: stageName,
            current: currentItem,
            total: totalItems,
            percentage,
            details: itemName,
          },
        );
      },

      succeed: (message?: string) => {
        this.succeedProgress(message || `${stageName} 完成`);
      },

      fail: (message?: string) => {
        this.failProgress(message || `${stageName} 失败`);
      },
    };
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.stopProgress();
    this.removeAllListeners();
  }
}

// 导出单例实例
const config = (() => {
  try {
    // 尝试获取配置管理器
    const { getConfigManager } = require("@/core/config");
    return getConfigManager();
  } catch {
    // 如果获取失败，返回默认配置
    return { isVerboseMode: () => false };
  }
})();

export const progressLogger = new ProgressLogger(config.isVerboseMode());
