const STORAGE_PREFIX = 'wob_explorer_';

export const storage = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  clear: (): void => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  },
};

// Session storage wrapper
export const session = {
  get: <T>(key: string): T | null => {
    try {
      const item = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Session storage get error:', error);
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Session storage set error:', error);
    }
  },

  remove: (key: string): void => {
    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error('Session storage remove error:', error);
    }
  },
};

// History tracking
export const history = {
  add: (path: string, data: any): void => {
    const history = storage.get<Array<{ path: string; data: any; timestamp: number }>>('history') || [];
    const newEntry = {
      path,
      data,
      timestamp: Date.now(),
    };
    
    // Keep only last 50 items
    const updatedHistory = [newEntry, ...history].slice(0, 50);
    storage.set('history', updatedHistory);
  },

  get: (limit: number = 10) => {
    const history = storage.get<Array<{ path: string; data: any; timestamp: number }>>('history') || [];
    return history.slice(0, limit);
  },

  clear: (): void => {
    storage.remove('history');
  },
};