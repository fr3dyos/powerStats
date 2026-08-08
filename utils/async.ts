/**
 * Concurrency-limited async iteration.
 *
 * Runs `fn` over every item in `items` but never more than `limit` calls
 * execute at the same time.  The result order matches the input order.
 *
 * Errors from individual items propagate (wrap `fn` in try/catch to handle
 * per-item failures without aborting the whole batch).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}
