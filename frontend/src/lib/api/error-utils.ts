/**
 * Error handling utilities for API operations
 * Provides common patterns for handling, logging, and displaying API errors
 */

export interface APIError {
  message: string;
  status?: number;
  code?: string;
  originalError?: any;
  requestId?: string;
  url?: string;
  method?: string;
}

/**
 * Check if an error is an API error
 */
export function isAPIError(error: any): error is APIError {
  return error instanceof Error && 'status' in error;
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatus(error: any): number | undefined {
  if (isAPIError(error)) {
    return error.status;
  }
  return undefined;
}

/**
 * Check if error is a network error (no response from server)
 */
export function isNetworkError(error: any): boolean {
  return error?.code === 'ECONNREFUSED' || 
         error?.code === 'ENOTFOUND' || 
         error?.message?.includes('No response received');
}

/**
 * Check if error is a timeout
 */
export function isTimeoutError(error: any): boolean {
  return error?.code === 'ECONNABORTED' || 
         error?.message?.includes('timeout');
}

/**
 * Check if error is a 404 (not found)
 */
export function isNotFoundError(error: any): boolean {
  return getErrorStatus(error) === 404;
}

/**
 * Check if error is a 401/403 (auth/permission)
 */
export function isAuthError(error: any): boolean {
  const status = getErrorStatus(error);
  return status === 401 || status === 403;
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: any): boolean {
  const status = getErrorStatus(error);
  return status ? status >= 500 && status < 600 : false;
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(error: any): boolean {
  const status = getErrorStatus(error);
  return status ? status >= 400 && status < 500 : false;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) except for 429 (rate limit)
      if (isClientError(error) && !isRateLimitError(error)) {
        throw error;
      }
      
      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
        error: error.message,
        status: getErrorStatus(error),
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if error is a 429 (rate limit)
 */
export function isRateLimitError(error: any): boolean {
  return getErrorStatus(error) === 429;
}

/**
 * Format error for logging/display
 */
export function formatError(error: any): string {
  if (!error) return 'Unknown error';
  
  const parts = [];
  
  // Add status code
  if (isAPIError(error) && error.status) {
    parts.push(`[${error.status}]`);
  }
  
  // Add message
  if (error.message) {
    parts.push(error.message);
  } else if (typeof error === 'string') {
    parts.push(error);
  }
  
  return parts.join(' ') || 'Unknown error';
}

/**
 * Log error with context
 */
export function logError(error: any, context?: Record<string, any>): void {
  const errorInfo = {
    message: error?.message,
    status: isAPIError(error) ? error.status : undefined,
    code: error?.code,
    type: error?.name,
    ...context,
  };
  
  // Filter out undefined values
  Object.keys(errorInfo).forEach(key => {
    if (errorInfo[key] === undefined) delete errorInfo[key];
  });
  
  console.error('Error:', errorInfo);
}

/**
 * Create a user-friendly error message based on error type
 */
export function getRecoveryMessage(error: any): string {
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  
  if (isTimeoutError(error)) {
    return 'Request took too long. Please try again.';
  }
  
  if (isNotFoundError(error)) {
    return 'The requested resource was not found.';
  }
  
  if (isAuthError(error)) {
    return 'Authentication failed. Please log in again.';
  }
  
  if (isServerError(error)) {
    return 'The server encountered an error. Please try again later.';
  }
  
  return 'Something went wrong. Please try again.';
}

/**
 * Combine multiple error messages
 */
export function combineErrors(errors: any[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return getUserErrorMessage(errors[0]);
  
  return errors.map((e, i) => `${i + 1}. ${getUserErrorMessage(e)}`).join('\n');
}
