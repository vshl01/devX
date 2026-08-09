import type { ApiErrorResponse } from "@/types/composer";

/** `Response.json` with the payload type checked at the call site. */
export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(error: string, status: number, code?: string): Response {
  return json<ApiErrorResponse>({ error, code }, { status });
}
