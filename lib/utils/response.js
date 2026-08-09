import { NextResponse } from 'next/server';
import { AppError, ErrorCodes, isAppError } from './errors.js';
import { logger } from './logger.js';

/**
 * @param {unknown} data
 * @param {number} [status=200]
 */
export function success(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {number} [status=500]
 */
export function failure(code, message, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}

/**
 * @param {unknown} error
 * @param {{ requestId?: string, prescriptionId?: string }} [context]
 */
export function handleRouteError(error, context = {}) {
  if (isAppError(error)) {
    logger.warn('request_failed', {
      requestId: context.requestId,
      prescriptionId: context.prescriptionId,
      code: error.code,
      message: error.message,
      status: error.status,
    });
    return failure(error.code, error.message, error.status);
  }

  logger.error('unhandled_error', {
    requestId: context.requestId,
    prescriptionId: context.prescriptionId,
    message: error instanceof Error ? error.message : 'Unknown error',
  });

  const isProd = process.env.NODE_ENV === 'production';
  return failure(
    ErrorCodes.INTERNAL_ERROR,
    isProd ? 'An unexpected error occurred.' : (error instanceof Error ? error.message : 'Unknown error'),
    500,
  );
}

/**
 * @param {unknown} error
 * @returns {never}
 */
export function assertNever(error) {
  throw error instanceof AppError
    ? error
    : new AppError(ErrorCodes.INTERNAL_ERROR, 'Unexpected error', 500);
}
