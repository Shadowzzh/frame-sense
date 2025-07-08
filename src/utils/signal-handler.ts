/**
 * 信号处理器 - 处理 Ctrl+C 等中断信号
 */

import chalk from "chalk";

/**
 * 信号处理器
 */
export class SignalHandler {
  /** 单例实例 */
  private static instance: SignalHandler | null = null;
  /** 清理函数列表 */
  private cleanupFunctions: (() => void | Promise<void>)[] = [];
  /** 是否正在关闭 */
  private isShuttingDown = false;

  /** 构造函数 */
  private constructor() {
    this.setupSignalHandlers();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SignalHandler {
    if (!SignalHandler.instance) {
      SignalHandler.instance = new SignalHandler();
    }
    return SignalHandler.instance; //
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers() {
    // 处理 Ctrl+C (SIGINT)
    process.on("SIGINT", () => {
      this.handleShutdown("SIGINT");
    });

    // 处理 SIGTERM
    process.on("SIGTERM", () => {
      this.handleShutdown("SIGTERM");
    });

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      console.error(chalk.red("未捕获的异常:"), error);
      this.handleShutdown("uncaughtException");
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason, _promise) => {
      console.error(chalk.red("未处理的 Promise 拒绝:"), reason);
      this.handleShutdown("unhandledRejection");
    });
  }

  /**
   * 添加清理函数
   */
  public addCleanupFunction(fn: () => void | Promise<void>) {
    this.cleanupFunctions.push(fn);
  }

  /**
   * 移除清理函数
   */
  public removeCleanupFunction(fn: () => void | Promise<void>) {
    const index = this.cleanupFunctions.indexOf(fn);
    if (index > -1) {
      this.cleanupFunctions.splice(index, 1);
    }
  }

  /**
   * 处理关闭信号
   */
  private async handleShutdown(_signal: string) {
    if (this.isShuttingDown) {
      process.exit(1);
    }

    this.isShuttingDown = true;

    try {
      const clearTask = this.cleanupFunctions.map(async (fn) => {
        try {
          await fn();
        } catch (error) {
          console.error(chalk.red("清理函数执行失败:"), error);
        }
      });

      // 执行所有清理函数
      await Promise.all(clearTask);
    } finally {
      process.exit(0);
    }
  }

  /**
   * 手动触发关闭
   */
  public async shutdown() {
    await this.handleShutdown("manual");
  }
}

/**
 * 获取信号处理器实例
 */
export function getSignalHandler(): SignalHandler {
  return SignalHandler.getInstance();
}
