import { ChromeRuntimeMessage } from "./types";
import { isExtensionContextInvalidError } from "./storage";
import { logError } from "./log";

export const sendRuntimeMessage = (message: ChromeRuntimeMessage, context: string): void => {
  try {
    chrome.runtime.sendMessage(message, (response?: { ok?: boolean; error?: string }) => {
      const err = chrome.runtime.lastError;
      if (err) {
        logError(`${context} sendMessage failed`, err.message);
        return;
      }
      if (response?.ok === false) {
        logError(`${context} failed`, response.error);
      }
    });
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      logError(`${context} sendMessage threw`, err);
    }
  }
};
