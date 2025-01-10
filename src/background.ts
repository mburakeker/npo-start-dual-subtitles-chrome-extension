import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";

// Constants
const allowedUrl = "https://npo.nl/start/";

// Event Listeners
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  if (tab?.url?.startsWith(allowedUrl) && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: ChromeRuntimeMessageType.InitiateMonitoring,
    } as ChromeRuntimeMessage);
  }
});

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
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=nl&tl=en&dt=t&q=${encodeURI(
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
