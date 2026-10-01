import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import { log } from "../shared/log";
import { formatWiktionaryNlDefinitions } from "./wiktionary";
import { parseGoogleTranslateResponse } from "./google";

const fetchWiktionary = async (word: string): Promise<string | null> => {
  const response = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (response.status !== 200) return null;
  const data = (await response.json()) as Record<
    string,
    Array<{
      partOfSpeech: string;
      definitions: Array<{ definition: string }>;
    }>
  >;
  return formatWiktionaryNlDefinitions(data);
};

const fetchGoogleTranslate = async (word: string, tl: string): Promise<string | null> => {
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=${tl}&dt=t&q=${encodeURIComponent(word)}`,
    {
      method: "GET",
      headers: {
        Connection: "keep-alive",
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
  if (response.status !== 200) return null;
  const data = await response.json();
  const text = parseGoogleTranslateResponse(data);
  return text || null;
};

export const translateWord = async (tabId: number, word: string): Promise<void> => {
  if (!word) return;
  const { selectedLanguage } = await chrome.storage.local.get("selectedLanguage");
  const tl = (selectedLanguage as string) || "en";
  log("translating word", { word, tl });

  const [wiktResult, gtResult] = await Promise.allSettled([
    fetchWiktionary(word),
    fetchGoogleTranslate(word, tl),
  ]);

  const wiktionary = wiktResult.status === "fulfilled" ? wiktResult.value : null;
  const googleTranslate = gtResult.status === "fulfilled" ? gtResult.value : null;

  await new Promise<void>((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: ChromeRuntimeMessageType.TranslateWordFinished,
        payload: JSON.stringify({ word, wiktionary, googleTranslate }),
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
