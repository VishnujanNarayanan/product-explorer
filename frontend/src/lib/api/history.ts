import { api } from './client';
import { ViewHistory } from '../types';

export const historyAPI = {
  // Note: Your backend doesn't have history endpoints yet
  // These are placeholder functions that store data locally
  
  trackView: (path: string, data: any) => {
    // Store in localStorage for now
    const history = JSON.parse(localStorage.getItem('wob_view_history') || '[]')
    history.unshift({
      path,
      data,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem('wob_view_history', JSON.stringify(history.slice(0, 50)))
    return Promise.resolve()
  },
  
  getViewHistory: () => {
    const history = JSON.parse(localStorage.getItem('wob_view_history') || '[]')
    const sessionId = localStorage.getItem('wob_session_id') || 'local'
    
    const viewHistory: ViewHistory[] = history.map((item: any, index: number) => ({
      id: index,
      session_id: sessionId,
      path_json: item,
      created_at: item.timestamp,
      user_id: null
    }))
    
    return Promise.resolve(viewHistory)
  },
};