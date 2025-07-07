/**
 * 统一日志管理系统
 */

import chalk from "chalk";

// 定义日志级别类型，从低到高：silent < error < warn < info < debug < verbose
export type LogLevel =
  | "silent" // 静默模式，不输出任何日志
  | "error" // 只输出错误信息
  | "warn" // 输出警告和错误信息
  | "info" // 输出信息、警告和错误信息
  | "debug" // 输出调试、信息、警告和错误信息
  | "verbose"; // 输出所有级别的日志信息

/** 日志配置接口 */
export interface LogConfig {
  level: LogLevel; // 日志级别，决定哪些日志会被输出
  colorized: boolean; // 是否使用彩色输出
  timestamp: boolean; // 是否在日志中包含时间戳
}

/**
 * 日志管理器类，使用单例模式确保全局唯一的日志实例
 */
class Logger {
  /** 日志配置 */
  private config: LogConfig;
  /** 单例实例 */
  private static instance: Logger;

  private constructor(config: LogConfig) {
    this.config = config;
  }

  /** 获取单例实例的静态方法 */
  static getInstance(config?: LogConfig): Logger {
    // 如果实例不存在，创建新实例
    if (!Logger.instance) {
      Logger.instance = new Logger(
        config || {
          level: "info", // 默认日志级别为 info
          colorized: true, // 默认启用彩色输出
          timestamp: false, // 默认不显示时间戳
        },
      );
    }
    // 如果传入了新配置，更新现有实例的配置
    if (config) {
      Logger.instance.config = config;
    }
    return Logger.instance; // 返回单例实例
  }

  /** 判断是否应该输出指定级别的日志 */
  private shouldLog(level: LogLevel): boolean {
    // 定义日志级别优先级数组，索引越小优先级越高
    const levels = ["silent", "error", "warn", "info", "debug", "verbose"];
    // 获取当前配置的日志级别在数组中的索引
    const currentLevel = levels.indexOf(this.config.level);
    // 获取要输出的日志级别在数组中的索引
    const messageLevel = levels.indexOf(level);

    // 只有当消息级别的优先级 >= 当前级别的优先级时才输出
    return messageLevel <= currentLevel;
  }

  // 格式化日志消息
  private formatMessage(message: string, level: LogLevel): string {
    let formatted = message; // 初始化格式化后的消息

    // 如果配置要求显示时间戳
    if (this.config.timestamp) {
      const timestamp = new Date().toISOString(); // 获取 ISO 格式的时间戳
      formatted = `[${timestamp}] ${formatted}`; // 在消息前添加时间戳
    }

    // 如果配置要求彩色输出
    if (this.config.colorized) {
      switch (level) {
        case "error":
          formatted = chalk.red(formatted); // 错误信息用红色
          break;
        case "warn":
          formatted = chalk.yellow(formatted); // 警告信息用黄色
          break;
        case "info":
          formatted = chalk.blue(formatted); // 信息用蓝色
          break;
        case "debug":
          formatted = chalk.gray(formatted); // 调试信息用灰色
          break;
        case "verbose":
          formatted = chalk.cyan(formatted); // 详细信息用青色
          break;
      }
    }

    return formatted; // 返回格式化后的消息
  }

  // 通用日志输出方法
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    // 如果不应该输出这个级别的日志，直接返回
    if (!this.shouldLog(level)) return;

    // 格式化消息
    const formatted = this.formatMessage(message, level);

    // 根据日志级别选择合适的输出方法
    if (level === "error") {
      console.error(formatted, ...args); // 错误信息用 console.error
    } else if (level === "warn") {
      console.warn(formatted, ...args); // 警告信息用 console.warn
    } else {
      console.log(formatted, ...args); // 其他信息用 console.log
    }
  }

  // 用户界面日志 - 总是显示（除非是silent）
  progress(message: string, ...args: unknown[]): void {
    // 如果是静默模式，不输出任何内容
    if (this.config.level === "silent") return;
    // 输出进度信息，根据配置决定是否使用蓝色
    console.log(this.config.colorized ? chalk.blue(message) : message, ...args);
  }

  // 成功信息输出
  success(message: string, ...args: unknown[]): void {
    // 如果是静默模式，不输出任何内容
    if (this.config.level === "silent") return;
    // 输出成功信息，根据配置决定是否使用绿色
    console.log(
      this.config.colorized ? chalk.green(message) : message,
      ...args,
    );
  }

  // 失败信息输出
  fail(message: string, ...args: unknown[]): void {
    // 如果是静默模式，不输出任何内容
    if (this.config.level === "silent") return;
    // 输出失败信息，根据配置决定是否使用红色
    console.log(this.config.colorized ? chalk.red(message) : message, ...args);
  }

  // 标准日志级别方法
  info(message: string, ...args: unknown[]): void {
    this.log("info", message, ...args); // 调用通用日志方法输出信息级别日志
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, ...args); // 调用通用日志方法输出警告级别日志
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, ...args); // 调用通用日志方法输出错误级别日志
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("debug", message, ...args); // 调用通用日志方法输出调试级别日志
  }

  verbose(message: string, ...args: unknown[]): void {
    this.log("verbose", message, ...args); // 调用通用日志方法输出详细级别日志
  }

  // 特殊用途日志
  stats(data: object): void {
    // 只有在调试级别或更高级别时才输出统计信息
    if (!this.shouldLog("debug")) return;
    console.log(
      this.config.colorized ? chalk.cyan("📊 统计信息:") : "📊 统计信息:",
      data,
    );
  }

  // 输出处理结果
  result(data: object): void {
    // 只有在信息级别或更高级别时才输出结果
    if (!this.shouldLog("info")) return;
    console.log(
      this.config.colorized ? chalk.green("✅ 处理结果:") : "✅ 处理结果:",
      data,
    );
  }

  // 原始输出（不受日志级别影响）
  raw(message: string, ...args: unknown[]): void {
    console.log(message, ...args); // 直接输出，不经过任何格式化或级别检查
  }
}

// 创建默认实例并导出
export const logger = Logger.getInstance();

// 配置日志系统的辅助函数
export function configureLogger(config: LogConfig): void {
  Logger.getInstance(config); // 更新单例实例的配置
}
