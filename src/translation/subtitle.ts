import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import { log } from "../shared/log";
import { parseGoogleTranslateResponse } from "./google";

export const translateSubtitle = async (
  tabId: number,
  subtitle: string,
  requestId?: number,
  sourceText?: string,
  prefetch = false
): Promise<void> => {
  if (!subtitle) return;
  const { selectedLanguage } = await chrome.storage.local.get("selectedLanguage");
  const tl = (selectedLanguage as string) || "en";

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=${tl}&dt=t&q=${encodeURIComponent(
    subtitle
  )}`;

  log("translating subtitle", { tl, length: subtitle.length, requestId, prefetch });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Connection: "keep-alive",
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Access-Control-Allow-Origin": "*",
    },
  });

  if (response.status !== 200) {
    throw new Error(`subtitle translate HTTP ${response.status}`);
  }

  const data = await response.json();
  const translatedText = parseGoogleTranslateResponse(data);
  log("subtitle translate ok", { prefetch, preview: translatedText?.slice?.(0, 80) });
  await sendTranslatedSubtitle(tabId, translatedText, requestId, sourceText ?? subtitle, prefetch);
};

const sendTranslatedSubtitle = (
  tabId: number,
  translatedText: string,
  requestId?: number,
  sourceText?: string,
  prefetch = false
): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: ChromeRuntimeMessageType.TranslateFinished,
        payload: translatedText,
        requestId,
        sourceText,
        prefetch,
      } as ChromeRuntimeMessage,
      () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      }
    );
  });
};
