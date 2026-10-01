import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";
import {
  getReleaseNote,
  storageKeyLastSeenWhatsNew,
} from "./whats-new";

const log = (...args: unknown[]): void => {
  console.info("[npo-dual-sub]", ...args);
};

const logWarn = (...args: unknown[]): void => {
  console.warn("[npo-dual-sub]", ...args);
};

const logError = (...args: unknown[]): void => {
  console.error("[npo-dual-sub]", ...args);
};

type RuntimeResponse = { ok: boolean; error?: string };

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
      translateSubtitle(tabId, req.payload)
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

const translateSubtitle = async (
  tabId: number,
  subtitle: string
): Promise<void> => {
  if (!subtitle) return;
  const { selectedLanguage } = await chrome.storage.local.get("selectedLanguage");
  const tl = (selectedLanguage as string) || "en";

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=${tl}&dt=t&q=${encodeURIComponent(
    subtitle
  )}`;

  log("translating subtitle", { tl, length: subtitle.length });

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
  const translatedText = data[0].map((item: string[]) => item[0]).join(" ");
  log("subtitle translate ok", translatedText?.slice?.(0, 80));
  await sendTranslatedSubtitle(tabId, translatedText);
};

const sendTranslatedSubtitle = (
  tabId: number,
  translatedText: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: ChromeRuntimeMessageType.TranslateFinished,
        payload: translatedText,
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

const fetchWiktionary = async (word: string): Promise<string | null> => {
  const response = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (response.status !== 200) return null;
  const data = await response.json() as Record<string, Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string }>;
  }>>;
  const nlEntries = data["nl"];
  if (!nlEntries || nlEntries.length === 0) return null;
  const lines: string[] = [];
  for (const entry of nlEntries) {
    if (lines.length >= 3) break;
    const def = entry.definitions[0]?.definition?.replace(/<[^>]+>/g, "");
    if (def) lines.push(`${entry.partOfSpeech}: ${def}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
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
  return (data[0] as string[][]).map((item: string[]) => item[0]).join(" ");
};

const translateWord = async (tabId: number, word: string): Promise<void> => {
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

const syncWhatsNewBadge = (): void => {
  const version = chrome.runtime.getManifest().version;
  const note = getReleaseNote(version);
  chrome.storage.local.get(storageKeyLastSeenWhatsNew, (data) => {
    const lastSeen = data[storageKeyLastSeenWhatsNew] as string | undefined;
    const showBadge = Boolean(note) && lastSeen !== version;
    void chrome.action.setBadgeText({ text: showBadge ? "NEW" : "" });
    if (showBadge) {
      void chrome.action.setBadgeBackgroundColor({ color: "#f56a00" });
      if (chrome.action.setBadgeTextColor) {
        void chrome.action.setBadgeTextColor({ color: "#ffffff" });
      }
    }
    // Restore the default icon in case an older build left a painted-dot icon.
    void chrome.action.setIcon({
      path: {
        128: "images/icon-128.png",
        256: "images/icon-256.png",
      },
    });
  });
};

chrome.runtime.onInstalled.addListener((details) => {
  // Fresh installs shouldn't need a "NEW" nudge; updates should.
  if (details.reason === "install") {
    chrome.storage.local.set({
      [storageKeyLastSeenWhatsNew]: chrome.runtime.getManifest().version,
    });
    void chrome.action.setBadgeText({ text: "" });
    return;
  }
  syncWhatsNewBadge();
});

chrome.runtime.onStartup.addListener(() => {
  syncWhatsNewBadge();
});

syncWhatsNewBadge();
