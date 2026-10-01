const LOG_PREFIX = "[npo-dual-sub]";

export const log = (...args: unknown[]): void => {
  console.info(LOG_PREFIX, ...args);
};

export const logWarn = (...args: unknown[]): void => {
  console.warn(LOG_PREFIX, ...args);
};

export const logError = (...args: unknown[]): void => {
  console.error(LOG_PREFIX, ...args);
};
