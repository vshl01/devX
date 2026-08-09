import { success, handleRouteError } from '@/lib/utils/response.js';
import { AppError, ErrorCodes } from '@/lib/utils/errors.js';

export const runtime = 'nodejs';

/**
 * POST /api/call/token
 * Proxies to the call-agent Python service's own /token endpoint, so the
 * browser never needs to know that service's URL directly and CORS stays
 * server-to-server.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const baseUrl = process.env.CALL_AGENT_URL;
    if (!baseUrl) {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'CALL_AGENT_URL is not configured.',
        503,
      );
    }

    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: body.patient_name }),
    });

    if (!res.ok) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        `Call agent /token failed with ${res.status}`,
        502,
      );
    }

    const data = await res.json();
    return success(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
