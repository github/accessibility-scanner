/**
 * Sleep for a given number of milliseconds.
 * @param ms Time to sleep, in milliseconds.
 * @returns
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}
