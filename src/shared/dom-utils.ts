export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
};

export const waitFor = (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
  if (predicate()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (predicate()) {
        cleanup();
        resolve(true);
      }
    });
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(predicate());
    }, timeoutMs);
    const cleanup = (): void => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
};
