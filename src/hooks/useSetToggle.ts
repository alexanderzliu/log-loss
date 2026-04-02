import { useState, useCallback } from 'react';

export function useSetToggle<T = string>(initialValues?: Iterable<T>): [Set<T>, (key: T) => void] {
  const [set, setSet] = useState<Set<T>>(() => new Set(initialValues));

  const toggle = useCallback((key: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return [set, toggle];
}
