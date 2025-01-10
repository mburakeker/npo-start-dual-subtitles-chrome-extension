import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";

// Constants
const subtitleOverlaySelector = ".bmpui-ui-subtitle-overlay";
const subtitleLabelSelector = ".bmpui-ui-subtitle-label";
const translatedSubtitleColor = "#1eb7d3";

// State
let lastText: string;
let lastTranslatedText: string;

// Event Listeners
chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.InitiateMonitoring) {
    monitorDomChanges();
  }
});

chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
    addTranslatedSubtitle(req.payload);
    lastTranslatedText = req.payload;
  }
});

// Functions
const monitorDomChanges = (): void => {
  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) return;

  const observer = new MutationObserver(handleMutations);
  const config = { attributes: false, childList: true, subtree: true, characterData: true } as MutationObserverInit;
  observer.observe(targetNode, config);
};

const handleMutations = async (): Promise<void> => {
  if (document.getElementsByClassName("translated").length > 0) return;

  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  if (!subtitleParentElement) return;

  if (subtitleParentElement.innerText === lastText) {
    addTranslatedSubtitle(lastTranslatedText);
    return;
  }

  chrome.runtime.sendMessage({ type: ChromeRuntimeMessageType.Translate, payload: subtitleParentElement.innerText } as ChromeRuntimeMessage);
  lastText = subtitleParentElement.innerText;
};

const addTranslatedSubtitle = (subtitle: string): void => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  const subtitleElement = subtitleParentElement.firstChild as HTMLElement | null;
  if (!subtitleElement) return;

  const newSpan = createTranslatedSpan(subtitle);
  insertTranslatedSpan(subtitleParentElement, newSpan);
};

const createTranslatedSpan = (subtitle: string): HTMLElement => {
  const newSpan = document.createElement("span");
  newSpan.innerText = subtitle;
  newSpan.classList.add("translated");
  newSpan.style.color = translatedSubtitleColor;
  newSpan.style.backgroundColor = "black";
  return newSpan;
};

const insertTranslatedSpan = (parent: HTMLElement, newSpan: HTMLElement): void => {
  const br = document.createElement("br");
  parent.insertBefore(br, parent.firstChild);
  parent.insertBefore(newSpan, parent.firstChild);
};