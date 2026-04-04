import { clickSettingsButton, hasNederlandsSubtitles, openSubtitleSettings, turnOffSubtitles, turnOnSubtitles } from "./onboarding-helper";
import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";

// Constants
const subtitleOverlaySelector = ".bmpui-ui-subtitle-overlay";
const subtitleLabelSelector = ".bmpui-ui-subtitle-label";
const controlbarBottomSelector = ".bmpui-ui-controlbar-bottom";
const toggleButtonId = "npo-dual-sub-toggle";
const translatedSubtitleColor = "#1eb7d3";
const storageKeyTranslationEnabled = "translationEnabled";

// State
let lastText: string;
let lastTranslatedText: string;
let translationObserver: MutationObserver | null = null;
let isTranslationActive = false;
let playerContainerObserver: MutationObserver | null = null;

// Event Listeners
chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.InitiateMonitoring) {
    startMonitoring();
  }
});

chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
    addTranslatedSubtitle(req.payload);
    lastTranslatedText = req.payload;
  }
});

chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.InitiateOneClickConfiguration) {
    startOnboarding();
  }
});

// Functions
const startMonitoring = (): void => {
  isTranslationActive = true;
  chrome.storage.local.set({ [storageKeyTranslationEnabled]: true });
  updateToggleButtonState();
  monitorDomChanges();
};

const activateWithSubtitles = (silent = false): void => {
  clickSettingsButton();
  setTimeout(() => {
    openSubtitleSettings();
  }, 200);
  setTimeout(() => {
    const success = turnOnSubtitles();
    if (!success) {
      // Close settings panel
      clickSettingsButton();
      if (!silent) {
        alert(
          'Could not turn on Dutch subtitles.\n\n' +
          'Please check that the content you are watching has subtitles available, ' +
          'then try activating again.'
        );
      }
      return;
    }
  }, 400);
  setTimeout(() => {
    clickSettingsButton();
  }, 600);
  setTimeout(() => {
    startMonitoring();
  }, 800);
};

const stopMonitoring = (): void => {
  isTranslationActive = false;
  chrome.storage.local.set({ [storageKeyTranslationEnabled]: false });
  if (translationObserver) {
    translationObserver.disconnect();
    translationObserver = null;
  }
  updateToggleButtonState();
};

const updateToggleButtonState = (): void => {
  const btn = document.getElementById(toggleButtonId) as HTMLButtonElement | null;
  if (!btn) return;
  if (isTranslationActive) {
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'Dual subtitles: on');
    btn.style.filter = 'none';
    btn.style.opacity = '1';
  } else {
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Dual subtitles: off');
    btn.style.filter = 'grayscale(1)';
    btn.style.opacity = '0.45';
  }
};

const monitorDomChanges = (): void => {
  if (translationObserver) return; // already running
  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) return;

  translationObserver = new MutationObserver(handleMutations);
  const config = { attributes: false, childList: true, subtree: true, characterData: true } as MutationObserverInit;
  translationObserver.observe(targetNode, config);
};

const handleMutations = async (): Promise<void> => {
  if (document.getElementsByClassName("translated").length > 0) return;

  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  if (!subtitleParentElement) return;

  const textToTranslate = subtitleParentElement.innerText.split("\n").join(" ");

  if (textToTranslate === lastText && lastTranslatedText !== undefined) {
    addTranslatedSubtitle(lastTranslatedText);
    return;
  }

  chrome.runtime.sendMessage({ type: ChromeRuntimeMessageType.Translate, payload: textToTranslate } as ChromeRuntimeMessage);
  lastText = textToTranslate;
}

const addTranslatedSubtitle = (subtitle: string): void => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  const subtitleElement = subtitleParentElement.firstChild as HTMLElement | null;
  if (!subtitleElement) return;

  const newSpan = createTranslatedSpan(subtitle);
  insertTranslatedSpan(subtitleParentElement, newSpan);
}

const createTranslatedSpan = (subtitle: string): HTMLElement => {
  const newSpan = document.createElement("span");
  newSpan.innerText = subtitle;
  newSpan.classList.add("translated");
  newSpan.style.color = translatedSubtitleColor;
  newSpan.style.backgroundColor = "black";
  return newSpan;
}

const insertTranslatedSpan = (parent: HTMLElement, newSpan: HTMLElement): void => {
  const br = document.createElement("br");
  parent.insertBefore(br, parent.firstChild);
  parent.insertBefore(newSpan, parent.firstChild);
}

const startOnboarding = (): void => {
  clickSettingsButton();
  setTimeout(() => {
    openSubtitleSettings();
  }, 200);
  setTimeout(() => {
    turnOffSubtitles();
  }, 400);
  setTimeout(() => {
    openSubtitleSettings();
  }, 600);
  setTimeout(() => {
    turnOnSubtitles();
  }, 800);
  setTimeout(() => {
    clickSettingsButton();
  }, 1000);
  setTimeout(() => {
    startMonitoring();
  }, 1200);
}

const injectToggleButton = (controlbar: Element): void => {
  if (document.getElementById(toggleButtonId)) return;

  const wrapper = controlbar.querySelector('.bmpui-container-wrapper');
  if (!wrapper) return;

  const spacer = wrapper.querySelector('.bmpui-ui-spacer');
  if (!spacer) return;

  const btn = document.createElement('button');
  btn.id = toggleButtonId;
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Dual subtitles: off');
  btn.setAttribute('title', 'Toggle dual subtitles');
  btn.className = 'bmpui-ui-button';

  // SVG as background-image data URI — same pattern all player buttons use
  const svgDataUri = "data:image/svg+xml;charset=utf-8,%3Csvg fill='none' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 260'%3E%3Cpath d='M120 70H245V185H215L235 245L155 185H120V70Z' fill='white' stroke='black' stroke-width='4' stroke-linejoin='round'/%3E%3Ctext x='145' y='150' font-family='Arial%2C sans-serif' font-size='60' font-weight='bold' fill='black'%3EEN%3C/text%3E%3Cpath d='M15 15H150V135H60L25 215V135H15V15Z' fill='%23FF7F00' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3Ctext x='22' y='95' font-family='Arial%2C sans-serif' font-size='55' font-weight='bold' fill='white'%3ENPO%3C/text%3E%3C/svg%3E";

  btn.style.backgroundImage = `url("${svgDataUri}")`;
  btn.style.width = '21px';
  btn.style.height = '40px';
  btn.style.padding = '0';
  btn.style.margin = '0';
  btn.style.backgroundSize = '18px';
  btn.style.filter = 'grayscale(1)';
  btn.style.opacity = '0.45';
  btn.style.transition = 'filter 0.2s, opacity 0.2s';

  // Empty label span to match the structure of other player buttons
  const label = document.createElement('span');
  label.className = 'bmpui-label';
  btn.appendChild(label);

  btn.addEventListener('click', () => {
    if (isTranslationActive) {
      stopMonitoring();
    } else {
      activateWithSubtitles(false);
    }
  });

  spacer.insertAdjacentElement('afterend', btn);

  // Auto-start: respect the last saved toggle state, then check subtitle availability
  chrome.storage.local.get(storageKeyTranslationEnabled, (data) => {
    const lastEnabled = data[storageKeyTranslationEnabled];
    // Default to true on first install (key not yet set)
    if (lastEnabled !== false && hasNederlandsSubtitles()) {
      activateWithSubtitles(true);
    }
  });
};

const watchForPlayerContainer = (): void => {
  const existing = document.querySelector(controlbarBottomSelector);
  if (existing) {
    injectToggleButton(existing);
    return;
  }

  playerContainerObserver = new MutationObserver(() => {
    const controlbar = document.querySelector(controlbarBottomSelector);
    if (controlbar && !document.getElementById(toggleButtonId)) {
      injectToggleButton(controlbar);
    }
  });

  playerContainerObserver.observe(document.body, { childList: true, subtree: true });
};

// Bootstrap auto-activation
watchForPlayerContainer();
