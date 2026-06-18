/**
 * Retry utility with exponential backoff
 * Retries failed API calls with increasing delays
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error: Error) => {
    // Don't retry auth errors or validation errors
    const msg = error.message.toLowerCase();
    if (msg.includes("401") || msg.includes("unauthorized")) return false;
    if (msg.includes("403") || msg.includes("forbidden")) return false;
    if (msg.includes("404") || msg.includes("not found")) return false;
    if (msg.includes("permission")) return false;
    // Retry network errors, timeouts, 5xx errors
    return true;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!opts.shouldRetry(lastError) || attempt === opts.maxRetries) {
        throw lastError;
      }

      // Wait before retrying with exponential backoff
      console.log(
        `[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error("Retry failed");
}

/**
 * Retry for specific timeout durations
 * Useful for network operations where you want a specific max duration
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}
