export function createDebouncedValue<TValue>(
  initialValue: TValue,
  delayMs: number,
  onValue: (value: TValue) => void
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return {
    next(value: TValue) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => onValue(value), delayMs);
    },
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
    flush(value = initialValue) {
      this.cancel();
      onValue(value);
    }
  };
}
