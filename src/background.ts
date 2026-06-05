import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";



chrome.runtime.onMessage.addListener(
  (req: ChromeRuntimeMessage, sender: chrome.runtime.MessageSender): void => {
    if (req.type === ChromeRuntimeMessageType.Translate && req.payload && sender.tab?.id) {
      translateSubtitle(sender.tab.id, req.payload);
    }
    if (req.type === ChromeRuntimeMessageType.TranslateWord && req.payload && sender.tab?.id) {
      translateWord(sender.tab.id, req.payload);
    }
  }
);

// Functions

const translateSubtitle = async (
  tabId: number,
  subtitle: string
): Promise<void> => {
  if (!subtitle) return;
  const { selectedLanguage } = await chrome.storage.local.get("selectedLanguage");

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=${selectedLanguage}&dt=t&q=${encodeURI(
    subtitle
  )}`;

  try {
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
      console.error(response.status);
      return;
    }

    const data = await response.json();
    const translatedText = data[0].map((item: string[]) => item[0]).join(" ");
    sendTranslatedSubtitle(tabId, translatedText);
  } catch (err) {
    console.error(err);
  }
};

const sendTranslatedSubtitle = (
  tabId: number,
  translatedText: string
): void => {
  chrome.tabs.sendMessage(tabId, {
    type: ChromeRuntimeMessageType.TranslateFinished,
    payload: translatedText,
  } as ChromeRuntimeMessage);
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

  const [wiktResult, gtResult] = await Promise.allSettled([
    fetchWiktionary(word),
    fetchGoogleTranslate(word, tl),
  ]);

  const wiktionary = wiktResult.status === "fulfilled" ? wiktResult.value : null;
  const googleTranslate = gtResult.status === "fulfilled" ? gtResult.value : null;

  chrome.tabs.sendMessage(tabId, {
    type: ChromeRuntimeMessageType.TranslateWordFinished,
    payload: JSON.stringify({ word, wiktionary, googleTranslate }),
  } as ChromeRuntimeMessage);
};
