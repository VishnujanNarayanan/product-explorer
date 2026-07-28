import { useHistoryContext } from '@/providers/HistoryProvider';

/**
 * Viewing history.
 *
 * This used to be a second, parallel implementation reading the same localStorage key as
 * the provider — two stores that never saw each other's writes, so a book recorded through
 * one was invisible to the other. There is one store now; this is the hook onto it.
 */
export const useHistory = useHistoryContext;
