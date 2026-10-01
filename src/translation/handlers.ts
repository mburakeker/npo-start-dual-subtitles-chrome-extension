import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import { logError, logWarn } from "../shared/log";
import { translateSubtitle } from "./subtitle";
import { translateWord } from "./word";

type RuntimeResponse = { ok: boolean; error?: string };

export const registerBackgroundTranslationHandlers = (): void => {
  chrome.runtime.onMessage.addListener(
    (
      req: ChromeRuntimeMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: RuntimeResponse) => void
    ): boolean | void => {
      if (req.type === ChromeRuntimeMessageType.Translate && req.payload) {
        if (!sender.tab?.id) {
          logWarn("translate message has no tab id");
          sendResponse({ ok: false, error: "no tab id" });
          return;
        }
        const tabId = sender.tab.id;
        const requestId = req.requestId;
        const sourceText = req.sourceText ?? req.payload;
        const prefetch = Boolean(req.prefetch);
        translateSubtitle(tabId, req.payload, requestId, sourceText, prefetch)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) => {
            logError("subtitle translate failed", err);
            sendResponse({ ok: false, error: String(err) });
          });
        return true;
      }
      if (req.type === ChromeRuntimeMessageType.TranslateWord && req.payload) {
        if (!sender.tab?.id) {
          logWarn("translate-word message has no tab id");
          sendResponse({ ok: false, error: "no tab id" });
          return;
        }
        const tabId = sender.tab.id;
        translateWord(tabId, req.payload)
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) => {
            logError("word translate failed", err);
            sendResponse({ ok: false, error: String(err) });
          });
        return true;
      }
    }
  );
};
