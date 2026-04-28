import { describe, expect, it, vi } from 'vitest';
import { createDebouncedValue } from '@/src/shared/utils/debounce-value';

describe('createDebouncedValue', () => {
  it('emits only the latest value after the delay', () => {
    vi.useFakeTimers();
    const onValue = vi.fn();
    const debounced = createDebouncedValue<string>('', 250, onValue);

    debounced.next('s');
    debounced.next('sh');
    debounced.next('sho');
    vi.advanceTimersByTime(249);

    expect(onValue).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onValue).toHaveBeenCalledWith('sho');
    vi.useRealTimers();
  });
});
