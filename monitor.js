// Constants
const subtitleOverlaySelector = ".bmpui-ui-subtitle-overlay";
const subtitleSpanSelector = ".bmpui-subtitle-region-container p:nth-child(1) > span:nth-child(1)";
const subtitleSpanParentSelector = ".bmpui-subtitle-region-container p:nth-child(1)";
const translatedSubtitleColor = "#1eb7d3";

// State
let lastText = "";
let lastTranslatedText = "";

// Event Listeners
chrome.runtime.onMessage.addListener((req) => {
  if (req.message === "initiateMonitoring") {
    monitorElementChanges();
  }
});

chrome.runtime.onMessage.addListener((req) => {
  if (req.message === "translateFinished") {
    addTranslatedSubtitle(req.payload);
    lastTranslatedText = req.payload;
  }
});

// Functions
const monitorElementChanges = () => {
  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) return;

  const observer = new MutationObserver(handleMutations);
  const config = { attributes: false, childList: true, subtree: true, characterData: true };
  observer.observe(targetNode, config);
};

const handleMutations = async () => {
  if (document.getElementsByClassName("translated").length > 0) return;

  const subtitleSpan = document.querySelector(subtitleSpanSelector);
  if (!subtitleSpan) return;

  if (subtitleSpan.innerText === lastText) {
    addTranslatedSubtitle(lastTranslatedText);
    return;
  }

  chrome.runtime.sendMessage({ message: "translate", payload: subtitleSpan.innerText });
  lastText = subtitleSpan.innerText;
};

const addTranslatedSubtitle = (subtitle) => {
  const subtitleSpanParent = document.querySelector(subtitleSpanParentSelector);
  const subtitleSpan = document.querySelector(subtitleSpanSelector);

  const newSpan = subtitleSpan.cloneNode(true);
  newSpan.innerText = subtitle;
  newSpan.classList.add("translated");
  newSpan.style.color = translatedSubtitleColor;

  const br = document.createElement("br");
  subtitleSpanParent.insertBefore(br, subtitleSpanParent.firstChild);
  subtitleSpanParent.insertBefore(newSpan, subtitleSpanParent.firstChild);
};