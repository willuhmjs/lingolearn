import { json } from '@sveltejs/kit';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Returns a consistent success JSON response.
 * @param data The data to include in the response.
 * @param status The HTTP status code (default: 200).
 */
export function successResponse<T>(data: T, status = 200) {
  return json(
    {
      success: true,
      data
    } as ApiResponse<T>,
    { status }
  );
}

/**
 * Returns a consistent error JSON response.
 * @param message The error message.
 * @param status The HTTP status code (default: 400).
 */
export function errorResponse(message: string, status = 400) {
  return json(
    {
      success: false,
      error: message
    } as ApiResponse,
    { status }
  );
}
