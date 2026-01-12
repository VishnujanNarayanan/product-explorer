"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ViewHistory } from '@/lib/types';

interface HistoryContextType {
  viewHistory: ViewHistory[];
  isLoading: boolean;
  trackView: (path: string, data: any) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [viewHistory, setViewHistory] = useState<ViewHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setIsLoading(true);
    try {
      const historyStr = localStorage.getItem('wob_view_history');
      if (historyStr) {
        const historyData = JSON.parse(historyStr);
        const sessionId = localStorage.getItem('wob_session_id') || 'local';
        
        const mappedHistory: ViewHistory[] = historyData.map((item: any, index: number) => ({
          id: index,
          session_id: sessionId,
          path_json: item,
          created_at: item.timestamp,
          user_id: null
        }));
        
        setViewHistory(mappedHistory);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const trackView = (path: string, data: any) => {
    try {
      const historyItem = {
        path,
        data,
        timestamp: new Date().toISOString()
      };

      const existing = JSON.parse(localStorage.getItem('wob_view_history') || '[]');
      const newHistory = [historyItem, ...existing.slice(0, 49)];
      
      localStorage.setItem('wob_view_history', JSON.stringify(newHistory));
      
      const sessionId = localStorage.getItem('wob_session_id') || 'local';
      setViewHistory(prev => [
        {
          id: Date.now(),
          session_id: sessionId,
          path_json: historyItem,
          created_at: historyItem.timestamp,
          user_id: null
        },
        ...prev.slice(0, 49)
      ]);
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('wob_view_history');
    setViewHistory([]);
  };

  return (
    <HistoryContext.Provider value={{ viewHistory, isLoading, trackView, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryContext() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return context;
}