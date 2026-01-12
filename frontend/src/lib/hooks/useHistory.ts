import { useState, useEffect, useCallback } from 'react';
import { ViewHistory } from '@/lib/types';

interface HistoryItem {
  path: string;
  data: any;
  timestamp: number;
}

export const useHistory = () => {
  const [viewHistory, setViewHistory] = useState<ViewHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(() => {
    setIsLoading(true);
    try {
      // Load from localStorage
      const historyStr = localStorage.getItem('wob_view_history');
      if (historyStr) {
        const historyItems: HistoryItem[] = JSON.parse(historyStr);
        const mappedHistory = historyItems.map(item => ({
          id: Math.random(),
          session_id: localStorage.getItem('wob_session_id') || 'local',
          path_json: item,
          created_at: new Date(item.timestamp).toISOString(),
          user_id: null,
        })) as ViewHistory[];
        setViewHistory(mappedHistory);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const trackView = useCallback((path: string, data: any) => {
    try {
      const historyItem: HistoryItem = {
        path,
        data,
        timestamp: Date.now(),
      };

      // Load existing history
      const existingStr = localStorage.getItem('wob_view_history');
      let existingHistory: HistoryItem[] = [];
      if (existingStr) {
        existingHistory = JSON.parse(existingStr);
      }

      // Add new item at beginning
      const newHistory = [historyItem, ...existingHistory.slice(0, 49)]; // Keep last 50 items

      // Save to localStorage
      localStorage.setItem('wob_view_history', JSON.stringify(newHistory));

      // Update state
      setViewHistory(prev => [
        {
          id: Math.random(),
          session_id: localStorage.getItem('wob_session_id') || 'local',
          path_json: historyItem,
          created_at: new Date().toISOString(),
          user_id: null,
        },
        ...prev.slice(0, 49),
      ]);
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem('wob_view_history');
      setViewHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }, []);

  return {
    viewHistory,
    isLoading,
    trackView,
    clearHistory,
    loadHistory,
  };
};