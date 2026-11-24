/**
 * A scripted fetch for the API-client tests. The client is the real module;
 * only the network is replaced, so what these tests prove is how the client
 * reads each documented server answer, not that the server sends it.
 */
export interface Sent {
  url: string;
  method: string;
  body: unknown;
}

export function mockFetch(
  answer: (sent: Sent) => { status?: number; body?: unknown; headers?: Record<string, string> } | Error,
): Sent[] {
  const calls: Sent[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const sent: Sent = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    };
    calls.push(sent);
    const r = answer(sent);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status ?? 200,
      headers: { "Content-Type": "application/json", ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
  return calls;
}

/** The in-memory SecureStore installed by scripts/securestore-fake.cjs. */
export const secureStore = (globalThis as unknown as { __secureStore: Map<string, string> }).__secureStore;
