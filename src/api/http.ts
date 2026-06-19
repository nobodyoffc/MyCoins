/**
 * fetch() with a hard timeout.
 *
 * React Native's fetch has no built-in timeout, so a slow or unreachable server
 * (e.g. a public explorer that's down or behind a Cloudflare challenge) would
 * hang forever. That stalls Promise.all in fetchAllBalances and leaves the
 * dashboard's pull-to-refresh spinner stuck (isLoading never clears).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
