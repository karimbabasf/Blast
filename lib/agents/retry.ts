// One retry on rate limits, server errors (any provider, "<label> <status>: "), timeouts and empty replies.

const RETRYABLE =
  / (429|5\d\d): |timeout|aborted|fetch failed|no audio|empty/i;

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof Error) || !RETRYABLE.test(err.message)) throw err;
    await new Promise((r) => setTimeout(r, 1_500));
    return fn();
  }
}
