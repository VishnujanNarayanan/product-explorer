"use client"

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

/** What a viewed book leaves behind, so the list can be rebuilt without refetching. */
export interface ViewedBook {
  source_id: string;
  title: string;
  author: string | null;
  price: number | null;
  image_url: string;
  category: string | null;
  /** ISO string — sortable, and readable when you look at localStorage directly. */
  viewed_at: string;
}

interface HistoryContextType {
  viewHistory: ViewedBook[];
  isLoading: boolean;
  trackView: (book: Omit<ViewedBook, 'viewed_at'>) => void;
  clearHistory: () => void;
}

const STORAGE_KEY = 'wob_view_history';
const MAX_ENTRIES = 50;

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

/**
 * Which books have been opened, kept in this browser.
 *
 * Deliberately local: there are no accounts, and the backend's view_history rows are keyed
 * by a scraper session that does not outlive a restart. Re-opening a book moves it back to
 * the top rather than adding a second row, so the page reads as "books you have looked at"
 * rather than "clicks you have made".
 */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [viewHistory, setViewHistory] = useState<ViewedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Entries written by the previous build had a different shape. Drop what cannot be
        // read rather than rendering blank rows for it.
        if (Array.isArray(parsed)) {
          setViewHistory(parsed.filter((item) => item && item.source_id && item.title));
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const trackView = useCallback((book: Omit<ViewedBook, 'viewed_at'>) => {
    setViewHistory((previous) => {
      const entry: ViewedBook = { ...book, viewed_at: new Date().toISOString() };
      const next = [
        entry,
        ...previous.filter((item) => item.source_id !== book.source_id),
      ].slice(0, MAX_ENTRIES);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save history:', error);
      }

      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setViewHistory([]);
  }, []);

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
