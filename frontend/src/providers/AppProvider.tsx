'use client';

import React from 'react';
import { SWRConfig } from 'swr';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './ThemeProvider';
import { HistoryProvider } from './HistoryProvider';
import { apiClient } from '@/lib/api/client';

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => apiClient.get(url).then(res => res.data),
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 2000,
      }}
    >
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <HistoryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
              success: {
                iconTheme: {
                  primary: 'hsl(var(--primary))',
                  secondary: 'hsl(var(--primary-foreground))',
                },
              },
              error: {
                iconTheme: {
                  primary: 'hsl(var(--destructive))',
                  secondary: 'hsl(var(--destructive-foreground))',
                },
              },
            }}
          />
        </HistoryProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}