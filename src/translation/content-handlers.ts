import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import { normalizeCueText } from "../cues/text";
import { log } from "../shared/log";
import {
  cueTranslationCache,
  cueTranslationRequestId,
  isTranslationActive,
  lastText,
  lastTranslatedText,
  setLastTranslatedText,
} from "./state";
import { addTranslatedSubtitle } from "../cues/overlay";
import { cacheCueTranslationFromMessage } from "./pipeline";
import { applyWordResult } from "../words/click";
import { WordResult } from "../words/state";

export const registerContentTranslationHandlers = (): void => {
  chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage, _sender, sendResponse) => {
    if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
      if (!isTranslationActive) {
        sendResponse({ ok: true });
        return;
      }

      const sourceText = req.sourceText ? normalizeCueText(req.sourceText) : undefined;
      if (sourceText) {
        cacheCueTranslationFromMessage(sourceText, req.payload);
        cueTranslationCache.clearInFlight(sourceText);
      }

      if (req.prefetch) {
        if (sourceText && sourceText === lastText && lastTranslatedText === undefined) {
          log("applying prefetched translation for active cue");
          setLastTranslatedText(req.payload);
          addTranslatedSubtitle(req.payload);
        }
        sendResponse({ ok: true });
        return;
      }

      if (req.requestId !== undefined && req.requestId !== cueTranslationRequestId) {
        log("ignoring stale translation", {
          requestId: req.requestId,
          activeRequestId: cueTranslationRequestId,
        });
        sendResponse({ ok: true });
        return;
      }
      log("received translation", req.payload.slice(0, 80));
      addTranslatedSubtitle(req.payload);
      setLastTranslatedText(req.payload);
      sendResponse({ ok: true });
      return;
    }
    if (req.type === ChromeRuntimeMessageType.TranslateWordFinished && req.payload) {
      const parsed = JSON.parse(req.payload) as {
        word: string;
        wiktionary: string | null;
        googleTranslate: string | null;
      };
      const result: WordResult = {
        wiktionary: parsed.wiktionary,
        googleTranslate: parsed.googleTranslate,
      };
      applyWordResult(parsed.word, result);
      sendResponse({ ok: true });
    }
  });
};
