export const isExtensionContextInvalidError = (err: unknown): boolean => {
  return err instanceof Error && /Extension context invalidated/i.test(err.message);
};

export const safeStorageSet = (items: Record<string, unknown>): void => {
  try {
    chrome.storage.local.set(items);
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      throw err;
    }
  }
};

export const safeStorageGet = (
  keys: string | string[],
  callback: (items: Record<string, unknown>) => void
): void => {
  try {
    chrome.storage.local.get(keys, callback);
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      throw err;
    }
  }
};
