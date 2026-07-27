import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Validate environment variables
if (typeof window !== 'undefined') {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    console.warn('NEXT_PUBLIC_API_URL is not set. Using default: http://localhost:3001');
  }
}

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const sessionId = getSessionId();
    if (sessionId && config.headers) {
      config.headers['X-Session-ID'] = sessionId;
    }
    
    // Add request ID for tracking
    if (config.headers) {
      config.headers['X-Request-ID'] = uuidv4();
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // You can transform response data here if needed
    return response;
  },
  (error) => {
    const { response, config, message } = error;
    const requestId = config?.headers?.['X-Request-ID'];
    
    // Build comprehensive error object for logging with default values
    const errorDetails = {
      requestId: requestId || 'unknown',
      url: config?.url || 'unknown',
      method: config?.method || 'unknown',
      status: response?.status || 'none',
      statusText: response?.statusText || 'no status',
      message: message || 'no message',
      responseData: response?.data || null,
      errorName: error.name || 'unknown',
      errorCode: error.code || 'unknown',
    };
    
    // Log as string to bypass Next.js console interception
    console.error('API Error: ' + JSON.stringify(errorDetails, null, 2));
    
    if (response) {
      // Handle specific status codes
      switch (response.status) {
        case 401:
          console.warn('Unauthorized - session may have expired');
          break;
        case 403:
          console.warn('Forbidden - insufficient permissions');
          break;
        case 404:
          console.warn('Resource not found:', config?.url);
          break;
        case 429:
          console.warn('Rate limited - too many requests');
          break;
        case 500:
          console.error('Server error:', response.data?.message);
          break;
        case 502:
        case 503:
        case 504:
          console.error('Service unavailable');
          break;
      }
      
      // Create a user-friendly error message
      const errorMessage = response.data?.message || 
                          response.data?.error || 
                          response.statusText || 
                          'An unexpected error occurred';
      
      error.userMessage = errorMessage;
    } else if (error.request) {
      console.error('No response received from server', {
        message: error.message,
        code: error.code,
        url: config?.url,
      });
      error.userMessage = 'No response received from server. Please check your connection.';
    } else {
      console.error('Request configuration error', {
        message: error.message,
      });
      error.userMessage = 'Failed to make request. Please try again.';
    }
    
    return Promise.reject(error);
  }
);

// Session management
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem('wob_session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('wob_session_id', sessionId);
  }
  
  return sessionId;
}

// API response wrapper with better typing
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  try {
    const response = await apiClient.request({
      method,
      url,
      data,
      ...config,
    });
    
    return response.data;
  } catch (error: any) {
    // Extract comprehensive error information
    const statusCode = error.response?.status;
    const errorData = error.response?.data;
    const userMessage = error.userMessage || 
                       errorData?.message || 
                       errorData?.error || 
                       error.message || 
                       'An unexpected error occurred';
    
    // Log detailed error for debugging with proper serialization
    const errorLog = {
      url: url || 'unknown',
      method: method || 'unknown',
      statusCode: statusCode || 'none',
      userMessage: userMessage || 'unknown error',
      fullError: {
        name: error.name || 'unknown',
        message: error.message || 'unknown',
        code: error.code || 'unknown',
      }
    };
    console.error('apiRequest error: ' + JSON.stringify(errorLog, null, 2));
    
    const enhancedError = new Error(userMessage);
    enhancedError.name = error.name || 'APIError';
    (enhancedError as any).status = statusCode;
    (enhancedError as any).code = error.code;
    (enhancedError as any).originalError = error;
    
    throw enhancedError;
  }
}

// Convenience methods
export const api = {
  get: <T>(url: string, config?: any) => apiRequest<T>('GET', url, undefined, config),
  post: <T>(url: string, data?: any, config?: any) => apiRequest<T>('POST', url, data, config),
  put: <T>(url: string, data?: any, config?: any) => apiRequest<T>('PUT', url, data, config),
  delete: <T>(url: string, config?: any) => apiRequest<T>('DELETE', url, undefined, config),
};

export { API_URL, APP_URL };

// Environment validation
export function validateEnvironment() {
  const required = ['NEXT_PUBLIC_API_URL'] as const;
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && typeof window !== 'undefined') {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
}

// Call validation on module load
if (typeof window !== 'undefined') {
  validateEnvironment();
}