/**
 * Sleep for a given number of milliseconds.
 * @param ms Time to sleep, in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

/**
 * Retry a function with exponential backoff.
 * @param fn The function to retry.
 * @param maxAttempts The maximum number of retry attempts.
 * @param baseDelay The base delay between attempts.
 * @param attempt The current attempt number.
 * @returns The result of the function or undefined if all attempts fail.
 */
export async function retry<T>(
  fn: () => Promise<T | null | undefined> | T | null | undefined,
  maxAttempts = 6,
  baseDelay = 2000,
  attempt = 1
): Promise<T | undefined> {
  const value = await fn();
  if (value != null) return value;
  if (attempt >= maxAttempts) return undefined;
  /** Exponential backoff, capped at 30s */
  const delay = Math.min(30000, baseDelay * 2 ** (attempt - 1));
  /** ±10% jitter */
  const jitter = 1 + (Math.random() - 0.5) * 0.2;
  await sleep(Math.round(delay * jitter));
  return retry(fn, maxAttempts, baseDelay, attempt + 1);
}
