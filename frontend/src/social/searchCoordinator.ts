export function createSearchCoordinator(delayMs = 350) {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule<T>(query: string, search: (query: string) => Promise<T>, apply: (value: T) => void, fail: () => void) {
      generation += 1;
      const current = generation;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void search(query).then((value) => { if (current === generation) apply(value); }).catch(() => { if (current === generation) fail(); });
      }, delayMs);
    },
    cancel() { generation += 1; if (timer) clearTimeout(timer); timer = null; },
  };
}
