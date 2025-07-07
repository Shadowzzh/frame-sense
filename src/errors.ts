/**
 * 统一错误处理模块
 */

/**
 * 格式化错误信息
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
