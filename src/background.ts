import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";



chrome.runtime.onMessage.addListener(
  (req: ChromeRuntimeMessage, sender: chrome.runtime.MessageSender): void => {
    if (req.type === ChromeRuntimeMessageType.Translate && req.payload && sender.tab?.id) {
      translateSubtitle(sender.tab.id, req.payload);
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
