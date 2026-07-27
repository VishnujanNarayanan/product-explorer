import { act, renderHook } from '@testing-library/react';
import { useSearch } from './useSearch';

describe('useSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Wrapped in act: draining a pending debounce timer flushes a state update.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts empty', () => {
    const { result } = renderHook(() => useSearch());

    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('marks itself searching as soon as a query is typed', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('hobbit'));
    expect(result.current.isSearching).toBe(true);
    // Not yet debounced.
    expect(result.current.debouncedQuery).toBe('');
  });

  it('publishes the query only after the debounce delay', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('hobbit'));
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current.debouncedQuery).toBe('');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.debouncedQuery).toBe('hobbit');
    expect(result.current.isSearching).toBe(false);
  });

  // The point of debouncing: typing quickly must not publish every intermediate value.
  it('restarts the timer on each keystroke', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('h'));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => result.current.setQuery('ho'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current.debouncedQuery).toBe('');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.debouncedQuery).toBe('ho');
  });

  it('clears the debounced query immediately when the input is emptied', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('hobbit'));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.debouncedQuery).toBe('hobbit');

    act(() => result.current.setQuery(''));
    expect(result.current.debouncedQuery).toBe('');
  });

  it('treats whitespace as no query', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('   '));
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it('clearSearch resets everything', () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('hobbit'));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    act(() => result.current.clearSearch());

    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });

  it('exposes results and total as views onto the same suggestion list', () => {
    const { result } = renderHook(() => useSearch());

    expect(result.current.results).toBe(result.current.suggestions);
    expect(result.current.total).toBe(result.current.suggestions.length);
  });

  it('cancels a pending timer when unmounted', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const { result, unmount } = renderHook(() => useSearch());

    act(() => result.current.setQuery('hobbit'));
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
