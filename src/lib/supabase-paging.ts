import type { PostgrestError } from '@supabase/supabase-js';

// Supabase returns at most 1000 rows per request.
const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Fetch every row of a query by requesting consecutive pages.
 * `page(from, to)` must return the query with a stable `.order()` and `.range(from, to)` applied.
 */
export async function fetchAllPages<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}
