import { api } from './client';
import { ScrapeJob } from '../types';

export const scraperAPI = {
  // Get scrape job status
  getJobStatus: (jobId: number) => 
    api.get<ScrapeJob>(`/jobs/${jobId}`),
  
  // Clear cache
  clearCache: () => 
    api.post<{ success: boolean; message: string }>('/cache/clear'),
  
  // Cleanup old data
  cleanupData: () => 
    api.post<{ deleted: number; message: string }>('/cleanup'),
  
  // Health check
  healthCheck: () => 
    api.get<{ status: string; timestamp: Date; services: any }>('/health'),
  
  // Test endpoint
  test: () => 
    api.get<{
      status: string;
      timestamp: Date;
      message: string;
      endpoints: Record<string, string>;
    }>('/test'),
};