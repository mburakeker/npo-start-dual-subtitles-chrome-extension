import { clickSettingsButton, closeSettingsPanel, isDutchSubtitleAlreadyOn, openSubtitleSettings, turnOnSubtitles } from "./onboarding-helper";
import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";

// Constants — NPO's player uses npoplayer-* classes (replaced Bitmovin bmpui-*)
const subtitleOverlaySelector = ".npoplayer-subtitle-overlay";
// New player has no separate label; cue text lives directly in the overlay.
const subtitleLabelSelector = ".npoplayer-subtitle-overlay";
const playerRootSelector = ".npoplayer-video";
const controlbarRightSelector = ".npoplayer-bottom-bar-container-right";
const toggleButtonId = "npo-dual-sub-toggle";
const noSubtitlesNoticeId = "npo-dual-sub-notice";
const translatedSubtitleColor = "#1eb7d3";
const storageKeyTranslationEnabled = "translationEnabled";
const LOG_PREFIX = "[npo-dual-sub]";

// State
let lastText: string | undefined;
let lastTranslatedText: string | undefined;
let translationObserver: MutationObserver | null = null;
let translationWaitObserver: MutationObserver | null = null;
let translationTargetNode: Element | null = null;
let isTranslationActive = false;
let isActivationInProgress = false;
let revalidateQueued = false;
let lastLocationKey = location.pathname + location.search;
let playerContainerObserver: MutationObserver | null = null;
let noSubtitlesNoticeTimer: number | null = null;

const log = (...args: unknown[]): void => {
  console.info(LOG_PREFIX, ...args);
};

const logWarn = (...args: unknown[]): void => {
  console.warn(LOG_PREFIX, ...args);
};

const logError = (...args: unknown[]): void => {
  console.error(LOG_PREFIX, ...args);
};

const dumpPlayerHints = (): void => {
  const classes = new Set<string>();
  document.querySelectorAll('[class*="npoplayer"], [class*="bmpui"]').forEach((el) => {
    el.classList.forEach((cls) => {
      if (cls.includes("npoplayer") || cls.includes("bmpui")) classes.add(cls);
    });
  });
  log("player hints", {
    href: location.href,
    isTopFrame: window === window.top,
    togglePresent: Boolean(document.getElementById(toggleButtonId)),
    controlbar: Boolean(document.querySelector(controlbarRightSelector)),
    overlay: Boolean(document.querySelector(subtitleOverlaySelector)),
    settingsToggle: Boolean(document.querySelector(".npoplayer-settings-toggle-button")),
    classes: [...classes].sort(),
  });
};

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
};

const waitFor = (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
  if (predicate()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (predicate()) {
        cleanup();
        resolve(true);
      }
    });
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(predicate());
    }, timeoutMs);
    const cleanup = (): void => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
};

const sendRuntimeMessage = (message: ChromeRuntimeMessage, context: string): void => {
  try {
    chrome.runtime.sendMessage(message, (response?: { ok?: boolean; error?: string }) => {
      const err = chrome.runtime.lastError;
      if (err) {
        logError(`${context} sendMessage failed`, err.message);
        return;
      }
      if (response?.ok === false) {
        logError(`${context} failed`, response.error);
      }
    });
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      logError(`${context} sendMessage threw`, err);
    }
  }
};

// Word click state
type WordResult = { wiktionary: string | null; googleTranslate: string | null };
type ResourceLink = { name: string; url: string };
const wordTranslationCache = new Map<string, WordResult>();
let currentClickedWord: string | null = null;
let tooltipEl: HTMLElement | null = null;
let clickAbortController: AbortController | null = null;
let wordClickObserver: MutationObserver | null = null;
let wordClickWaitObserver: MutationObserver | null = null;
let wordClickTargetNode: Element | null = null;
let isPausedByWordHover = false;
const storageKeyWordClickEnabled = "wordClickEnabled";
const storageKeyAutoPauseEnabled = "autoPauseEnabled";
let currentSelectedLanguage = "en";
let isAutoPauseEnabled = true;
let isWordClickEnabled = true;

const isExtensionContextInvalidError = (err: unknown): boolean => {
  return err instanceof Error && /Extension context invalidated/i.test(err.message);
};

const safeStorageSet = (items: Record<string, unknown>): void => {
  try {
    chrome.storage.local.set(items);
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      throw err;
    }
  }
};

const safeStorageGet = (
  keys: string | string[],
  callback: (items: Record<string, unknown>) => void
): void => {
  try {
    chrome.storage.local.get(keys, callback);
  } catch (err) {
    if (!isExtensionContextInvalidError(err)) {
      throw err;
    }
  }
};

const languageCodeToIso3: Record<string, string> = {
  en: "eng",
  fr: "fra",
  de: "deu",
  es: "spa",
  it: "ita",
  pt: "por",
  ru: "rus",
  zh: "zho",
  ja: "jpn",
  ko: "kor",
  ar: "ara",
  hi: "hin",
  tr: "tur",
  pl: "pol",
  sv: "swe",
  da: "dan",
  fi: "fin",
  no: "nor",
  cs: "ces",
  sk: "slk",
  hu: "hun",
  ro: "ron",
  bg: "bul",
  el: "ell",
  th: "tha",
  vi: "vie",
  id: "ind",
  hy: "hye",
  az: "aze",
  ka: "kat",
};

const getResourceLinksForWord = (word: string, targetLanguage: string): ResourceLink[] => {
  const query = encodeURIComponent(word);
  const targetLangIso3 = languageCodeToIso3[targetLanguage] ?? "eng";

  return [
    { name: "DeepL", url: `https://www.deepl.com/translator#nl/${targetLanguage}/${query}` },
    { name: "Forvo", url: `https://forvo.com/search/${query}/` },
    { name: "Google Images", url: `https://www.google.com/images?q=${query}` },
    { name: "Google Translate", url: `https://translate.google.com/#nl/${targetLanguage}/${query}` },
    {
      name: "Tatoeba",
      url: `https://tatoeba.org/eng/sentences/search?from=nld&to=${targetLangIso3}&query=${query}`,
    },
    { name: "Wiktionary", url: `https://en.m.wiktionary.org/wiki/${query}#Dutch` },
  ];
};

// Event Listeners
chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage, _sender, sendResponse) => {
  if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
    log("received translation", req.payload.slice(0, 80));
    addTranslatedSubtitle(req.payload);
    lastTranslatedText = req.payload;
    sendResponse({ ok: true });
    return;
  }
  if (req.type === ChromeRuntimeMessageType.TranslateWordFinished && req.payload) {
    const parsed = JSON.parse(req.payload) as { word: string; wiktionary: string | null; googleTranslate: string | null };
    const result: WordResult = { wiktionary: parsed.wiktionary, googleTranslate: parsed.googleTranslate };
    wordTranslationCache.set(parsed.word, result);
    if (parsed.word === currentClickedWord) {
      updateTooltipContent(result);
    }
    sendResponse({ ok: true });
  }
});

// Functions
const startMonitoring = (): void => {
  isTranslationActive = true;
  safeStorageSet({ [storageKeyTranslationEnabled]: true });
  hideNoSubtitlesNotice();
  updateToggleButtonState();
  monitorDomChanges();
};

const updateToggleButtonPending = (pending: boolean): void => {
  const btn = document.getElementById(toggleButtonId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.setAttribute("aria-busy", pending ? "true" : "false");
  if (pending) {
    btn.style.filter = "none";
    btn.style.opacity = "0.75";
    return;
  }
  updateToggleButtonState();
};

const activateWithSubtitles = async (silent = false): Promise<void> => {
  log("activating dual subtitles");
  updateToggleButtonPending(true);

  clickSettingsButton();
  const panelOpen = await waitFor(() => {
    const panel = document.querySelector(".npoplayer-settings-panel");
    return Boolean(panel && !panel.classList.contains("npoplayer-hidden"));
  }, 2500);
  log("settings panel open", panelOpen);
  if (!panelOpen) dumpPlayerHints();

  if (!isDutchSubtitleAlreadyOn()) {
    openSubtitleSettings();
    const dutchOptionReady = await waitFor(() => turnOnSubtitles(), 2500);
    log("Dutch subtitle option ready", dutchOptionReady);
  }

  const success = turnOnSubtitles();
  log("Dutch subtitles enabled", success);
  closeSettingsPanel();

  if (!success) {
    logWarn("could not enable Dutch subtitles");
    dumpPlayerHints();
    stopMonitoring();
    if (!silent) showNoSubtitlesNotice();
    return;
  }

  startMonitoring();
  const overlayReady = await waitFor(
    () => Boolean(document.querySelector(subtitleOverlaySelector)),
    8000
  );
  log("subtitle overlay after enable", overlayReady ? "ready" : "still missing");
  if (!overlayReady) dumpPlayerHints();
};

const stopMonitoring = (): void => {
  log("stopping dual subtitles");
  isTranslationActive = false;
  safeStorageSet({ [storageKeyTranslationEnabled]: false });
  translationWaitObserver?.disconnect();
  translationWaitObserver = null;
  translationTargetNode = null;
  if (translationObserver) {
    translationObserver.disconnect();
    translationObserver = null;
  }
  updateToggleButtonState();
};

const attachTranslationObserver = (targetNode: Element): void => {
  if (translationObserver && translationTargetNode === targetNode) return;

  if (translationObserver) {
    translationObserver.disconnect();
    translationObserver = null;
  }

  translationTargetNode = targetNode;
  translationObserver = new MutationObserver(handleMutations);
  const config = { attributes: false, childList: true, subtree: true, characterData: true } as MutationObserverInit;
  translationObserver.observe(targetNode, config);
  log("observing subtitle overlay");
  void handleMutations();
};

const updateToggleButtonState = (): void => {
  const btn = document.getElementById(toggleButtonId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.setAttribute("aria-busy", "false");
  if (isTranslationActive) {
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'Dual subtitles: on');
    btn.setAttribute('title', 'Toggle dual subtitles');
    btn.style.filter = 'none';
    btn.style.opacity = '1';
  } else {
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Dual subtitles: off');
    btn.setAttribute('title', 'Toggle dual subtitles');
    btn.style.filter = 'grayscale(1)';
    btn.style.opacity = '0.45';
  }
};

const hideNoSubtitlesNotice = (): void => {
  if (noSubtitlesNoticeTimer !== null) {
    window.clearTimeout(noSubtitlesNoticeTimer);
    noSubtitlesNoticeTimer = null;
  }
  document.getElementById(noSubtitlesNoticeId)?.remove();
};

const positionNoSubtitlesNotice = (notice: HTMLElement, btn: HTMLElement | null): void => {
  const noticeRect = notice.getBoundingClientRect();
  const rect = btn?.getBoundingClientRect();
  if (!rect) {
    notice.style.left = "50%";
    notice.style.bottom = "88px";
    notice.style.top = "auto";
    notice.style.transform = "translateX(-50%)";
    return;
  }

  let left = rect.right - noticeRect.width;
  let top = rect.top - noticeRect.height - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - noticeRect.width - 8));
  if (top < 8) top = rect.bottom + 12;
  notice.style.left = `${left}px`;
  notice.style.top = `${top}px`;
  notice.style.bottom = "auto";
  notice.style.transform = "none";
};

const showNoSubtitlesNotice = (): void => {
  hideNoSubtitlesNotice();
  const message = "No Dutch subtitles available for this video";
  const btn = document.getElementById(toggleButtonId) as HTMLButtonElement | null;
  if (btn) {
    btn.setAttribute("title", message);
    btn.setAttribute("aria-label", message);
  }

  const host =
    document.fullscreenElement instanceof HTMLElement
      ? document.fullscreenElement
      : (btn?.closest(playerRootSelector) as HTMLElement | null) ?? document.body;

  const notice = document.createElement("div");
  notice.id = noSubtitlesNoticeId;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.style.position = "fixed";
  notice.style.zIndex = "2147483646";
  notice.style.display = "flex";
  notice.style.alignItems = "center";
  notice.style.gap = "10px";
  notice.style.maxWidth = "min(340px, calc(100vw - 16px))";
  notice.style.padding = "12px 12px 12px 14px";
  notice.style.background = "#1a1a2e";
  notice.style.color = "#f4f4f4";
  notice.style.fontFamily = "Arial, sans-serif";
  notice.style.fontSize = "14px";
  notice.style.lineHeight = "1.4";
  notice.style.fontWeight = "600";
  notice.style.borderRadius = "8px";
  notice.style.border = "1px solid rgba(255,255,255,0.16)";
  notice.style.boxShadow = "0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)";
  notice.style.pointerEvents = "auto";
  notice.addEventListener("click", (e) => e.stopPropagation());

  const text = document.createElement("span");
  text.textContent = message;
  notice.appendChild(text);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.all = "unset";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.color = "rgba(255,255,255,0.55)";
  closeBtn.style.fontSize = "22px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.padding = "0 2px";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideNoSubtitlesNotice();
    updateToggleButtonState();
  });
  notice.appendChild(closeBtn);

  host.appendChild(notice);
  positionNoSubtitlesNotice(notice, btn);
  notice.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 180, easing: "ease-out", fill: "forwards" }
  );

  noSubtitlesNoticeTimer = window.setTimeout(() => {
    hideNoSubtitlesNotice();
    updateToggleButtonState();
  }, 6000);
};

const monitorDomChanges = (): void => {
  if (!translationWaitObserver) {
    translationWaitObserver = new MutationObserver(() => {
      if (!isTranslationActive) return;
      const currentTarget = document.querySelector(subtitleOverlaySelector);
      if (currentTarget && currentTarget !== translationTargetNode) {
        log("subtitle overlay appeared or was replaced");
        attachTranslationObserver(currentTarget);
      }
    });
    translationWaitObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) {
    log("subtitle overlay not in DOM yet, waiting");
    return;
  }

  attachTranslationObserver(targetNode);
};

const getDutchSubtitleText = (subtitleParent: HTMLElement): string => {
  const clone = subtitleParent.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".translated").forEach((el) => el.remove());
  return clone.innerText.split("\n").join(" ").replace(/\s+/g, " ").trim();
};

const handleMutations = async (): Promise<void> => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  if (!subtitleParentElement) return;

  const textToTranslate = getDutchSubtitleText(subtitleParentElement);
  if (!textToTranslate) return;

  if (textToTranslate === lastText && lastTranslatedText !== undefined) {
    if (!subtitleParentElement.querySelector(".translated")) {
      addTranslatedSubtitle(lastTranslatedText);
    }
    return;
  }

  subtitleParentElement.querySelectorAll(".translated").forEach((el) => el.remove());
  log("translating cue", textToTranslate.slice(0, 80));
  sendRuntimeMessage(
    { type: ChromeRuntimeMessageType.Translate, payload: textToTranslate } as ChromeRuntimeMessage,
    "translate"
  );
  lastText = textToTranslate;
};

const addTranslatedSubtitle = (subtitle: string): void => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  if (!subtitleParentElement) {
    logWarn("cannot insert translation, overlay missing");
    return;
  }

  subtitleParentElement.querySelectorAll(".translated").forEach((el) => el.remove());
  const newSpan = createTranslatedSpan(subtitle);
  insertTranslatedSpan(subtitleParentElement, newSpan);
};

const createTranslatedSpan = (subtitle: string): HTMLElement => {
  const newSpan = document.createElement("span");
  newSpan.innerText = subtitle;
  newSpan.classList.add("translated");
  // Position above the native cue without changing the overlay's flex layout
  // (flex-wrap / flex-basis blows up the player's subtitle font sizing).
  newSpan.style.position = "absolute";
  newSpan.style.left = "50%";
  newSpan.style.bottom = "100%";
  newSpan.style.transform = "translateX(-50%)";
  newSpan.style.marginBottom = "0.35em";
  newSpan.style.whiteSpace = "normal";
  newSpan.style.maxWidth = "90vw";
  newSpan.style.textAlign = "center";
  newSpan.style.color = translatedSubtitleColor;
  newSpan.style.backgroundColor = "black";
  newSpan.setAttribute("lang", `${currentSelectedLanguage}-x-mtfrom-nl`);
  return newSpan;
};

const insertTranslatedSpan = (parent: HTMLElement, newSpan: HTMLElement): void => {
  parent.insertBefore(newSpan, parent.firstChild);
};

const subtitlePointerStyleId = 'npo-subtitle-pointer-styles';

const injectSubtitlePointerStyles = (): void => {
  if (document.getElementById(subtitlePointerStyleId)) return;
  const style = document.createElement('style');
  style.id = subtitlePointerStyleId;
  // Keep pointer-events:none on the overlay so non-text clicks fall through to
  // .npoplayer-click-overlay / controls; only npo-word elements receive clicks.
  // Use a custom element (not <span>) so player CSS that styles overlay spans
  // does not add extra spacing between words.
  const tooltipCss = [
    '#npo-word-tooltip { position:fixed; display:none; z-index:2147483647; background:#1a1a2e; color:#e8e8e8; font-family:Arial,sans-serif; border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.65),0 2px 8px rgba(0,0,0,0.4); min-width:300px; max-width:420px; pointer-events:auto; border:1px solid rgba(255,255,255,0.12); overflow:hidden; user-select:text; -webkit-user-select:text; }',
    '.npo-tt-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px 8px; background:rgba(255,255,255,0.07); border-bottom:1px solid rgba(255,255,255,0.1); }',
    '.npo-tt-word { font-size:16px; font-weight:bold; color:#fff; letter-spacing:0.03em; }',
    '.npo-tt-close { all:unset; cursor:pointer; color:rgba(255,255,255,0.5); font-size:20px; line-height:1; padding:0 2px; border-radius:3px; }',
    '.npo-tt-close:hover { color:#fff; }',
    '.npo-tt-section { padding:8px 14px 10px; border-bottom:1px solid rgba(255,255,255,0.07); }',
    '.npo-tt-section:last-child { border-bottom:none; }',
    '.npo-tt-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.45); margin-bottom:4px; }',
    '.npo-tt-text { font-size:14px; line-height:1.55; color:#e8e8e8; word-break:break-word; white-space:pre-line; user-select:text; -webkit-user-select:text; cursor:text; }',
    '.npo-tt-not-found { color:rgba(255,255,255,0.35); font-style:italic; }',
    '.npo-tt-attribution-inline { font-size:10px; color:rgba(255,255,255,0.4); text-decoration:none; font-weight:normal; text-transform:none; letter-spacing:0; }',
    '.npo-tt-attribution-inline:hover { color:rgba(255,255,255,0.7); }',
    '.npo-tt-links { display:flex; flex-wrap:wrap; gap:6px; }',
    '.npo-tt-link { font-size:11px; color:#9cc9ff; text-decoration:none; border:1px solid rgba(156,201,255,0.25); border-radius:999px; padding:3px 8px; }',
    '.npo-tt-link:hover { color:#d6e9ff; border-color:rgba(214,233,255,0.55); }',
  ];
  style.textContent = [
    `${playerRootSelector} .npoplayer-subtitle-overlay { z-index: 20 !important; pointer-events: none !important; }`,
    `${playerRootSelector} .npoplayer-subtitle-overlay npo-word { display: inline !important; margin: 0 !important; padding: 0 !important; border: none !important; font: inherit !important; font-size: inherit !important; line-height: inherit !important; letter-spacing: inherit !important; word-spacing: inherit !important; color: inherit !important; background: transparent !important; pointer-events: auto !important; cursor: pointer !important; text-decoration: underline dotted rgba(255,255,255,0.55) !important; }`,
    `${playerRootSelector} .npoplayer-settings-panel { z-index: 30 !important; pointer-events: auto !important; }`,
    `${playerRootSelector}:has(.npoplayer-settings-panel:not(.npoplayer-hidden)) .npoplayer-subtitle-overlay npo-word { pointer-events: none !important; }`,
    ...tooltipCss,
  ].join('\n');
  document.head.appendChild(style);
};

const removeSubtitlePointerStyles = (): void => {
  document.getElementById(subtitlePointerStyleId)?.remove();
};

const getOrCreateTooltip = (host?: HTMLElement): HTMLElement => {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'npo-word-tooltip';
    tooltipEl.addEventListener('click', (e) => e.stopPropagation());
    (host ?? document.body).appendChild(tooltipEl);
  } else if (host && tooltipEl.parentElement !== host) {
    host.appendChild(tooltipEl);
  }
  return tooltipEl;
};

const renderTooltipContent = (tip: HTMLElement, word: string, result: WordResult | null): void => {
  tip.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'npo-tt-header';
  const wordSpan = document.createElement('span');
  wordSpan.className = 'npo-tt-word';
  wordSpan.textContent = word;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'npo-tt-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hideTooltip(); });
  header.appendChild(wordSpan);
  header.appendChild(closeBtn);
  tip.appendChild(header);

  const makeSection = (label: string, value: string | null | undefined): void => {
    const section = document.createElement('div');
    section.className = 'npo-tt-section';
    const lbl = document.createElement('div');
    lbl.className = 'npo-tt-label';
    lbl.textContent = label;
    const txt = document.createElement('div');
    txt.className = 'npo-tt-text';
    if (value === undefined) {
      txt.textContent = '\u2026';
    } else if (value) {
      txt.textContent = value;
    } else {
      txt.textContent = 'Not found';
      txt.classList.add('npo-tt-not-found');
    }
    section.appendChild(lbl);
    section.appendChild(txt);
    tip.appendChild(section);
  };

  makeSection('Dictionary (Wiktionary)', result === null ? undefined : result.wiktionary);

  // Google Translate section with attribution
  const gtSection = document.createElement('div');
  gtSection.className = 'npo-tt-section';
  const gtLabel = document.createElement('div');
  gtLabel.className = 'npo-tt-label';
  const gtLabelText = document.createElement('span');
  gtLabelText.textContent = 'Translation (';
  const gtAttrLink = document.createElement('a');
  gtAttrLink.className = 'npo-tt-attribution npo-tt-attribution-inline';
  gtAttrLink.href = 'https://translate.google.com';
  gtAttrLink.target = '_blank';
  gtAttrLink.rel = 'noopener noreferrer';
  gtAttrLink.textContent = 'Powered by Google Translate';
  const gtLabelEnd = document.createElement('span');
  gtLabelEnd.textContent = ')';
  gtLabel.appendChild(gtLabelText);
  gtLabel.appendChild(gtAttrLink);
  gtLabel.appendChild(gtLabelEnd);
  const gtTxt = document.createElement('div');
  gtTxt.className = 'npo-tt-text';
  const gtValue = result === null ? undefined : result.googleTranslate;
  if (gtValue === undefined) {
    gtTxt.textContent = '\u2026';
  } else if (gtValue) {
    gtTxt.textContent = gtValue;
  } else {
    gtTxt.textContent = 'Not found';
    gtTxt.classList.add('npo-tt-not-found');
  }
  gtSection.appendChild(gtLabel);
  gtSection.appendChild(gtTxt);
  tip.appendChild(gtSection);

  const linksSection = document.createElement('div');
  linksSection.className = 'npo-tt-section';
  const linksLabel = document.createElement('div');
  linksLabel.className = 'npo-tt-label';
  linksLabel.textContent = 'Learn More';
  const linksContainer = document.createElement('div');
  linksContainer.className = 'npo-tt-links';
  const links = getResourceLinksForWord(word, currentSelectedLanguage);
  for (const link of links) {
    const anchor = document.createElement('a');
    anchor.className = 'npo-tt-link';
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = link.name;
    linksContainer.appendChild(anchor);
  }
  linksSection.appendChild(linksLabel);
  linksSection.appendChild(linksContainer);
  tip.appendChild(linksSection);
};

const positionTooltip = (tip: HTMLElement, wordEl: HTMLElement): void => {
  const rect = wordEl.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  let top = rect.top - tipRect.height - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  if (top < 8) top = rect.bottom + 12;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
};

const showTooltip = (wordEl: HTMLElement, word: string, result: WordResult | null): void => {
  const host = wordEl.closest(playerRootSelector) as HTMLElement | null;
  const tip = getOrCreateTooltip(host ?? undefined);
  renderTooltipContent(tip, word, result);
  tip.style.display = 'block';
  positionTooltip(tip, wordEl);
};

const getPlayerVideo = (): HTMLVideoElement | null => {
  return document.querySelector<HTMLVideoElement>(`${playerRootSelector} video`);
};

const getPlayToggleButton = (): HTMLElement | null => {
  return (
    document.querySelector<HTMLElement>(".npoplayer-small-play-button:not(.npoplayer-hidden)") ||
    document.querySelector<HTMLElement>(".npoplayer-play-button:not(.npoplayer-hidden)") ||
    document.querySelector<HTMLElement>(".npoplayer-small-play-button") ||
    document.querySelector<HTMLElement>(".npoplayer-play-button")
  );
};

const updateTooltipContent = (result: WordResult): void => {
  if (!tooltipEl || tooltipEl.style.display === 'none') return;
  const texts = tooltipEl.querySelectorAll<HTMLElement>('.npo-tt-text');
  if (texts[0]) {
    texts[0].textContent = result.wiktionary ?? 'Not found';
    texts[0].classList.toggle('npo-tt-not-found', !result.wiktionary);
  }
  if (texts[1]) {
    texts[1].textContent = result.googleTranslate ?? 'Not found';
    texts[1].classList.toggle('npo-tt-not-found', !result.googleTranslate);
  }
};

const hideTooltip = (): void => {
  if (tooltipEl) tooltipEl.style.display = 'none';
  currentClickedWord = null;
};

const pauseVideoOnce = (): boolean => {
  const btn = getPlayToggleButton();
  if (btn) {
    // Player marks paused state with the `paused` class on the play button.
    if (btn.classList.contains("paused")) return false;
    btn.click();
    return true;
  }
  const video = getPlayerVideo();
  if (!video || video.paused) return false;
  video.pause();
  return true;
};

const playVideoOnce = (): boolean => {
  const btn = getPlayToggleButton();
  if (btn) {
    if (!btn.classList.contains("paused")) return false;
    btn.click();
    return true;
  }
  const video = getPlayerVideo();
  if (!video || !video.paused) return false;
  void video.play();
  return true;
};

const isVideoPlaying = (): boolean => {
  const btn = getPlayToggleButton();
  if (btn) return !btn.classList.contains("paused");
  const video = getPlayerVideo();
  return Boolean(video && !video.paused);
};

const wrapWordsInSubtitle = (subtitleLabel: HTMLElement): void => {
  if (subtitleLabel.querySelector('npo-word')) return;

  const walker = document.createTreeWalker(
    subtitleLabel,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node): number {
        let parent = node.parentElement;
        while (parent && parent !== subtitleLabel) {
          if (parent.classList.contains('translated') || parent.tagName === 'NPO-WORD') {
            return NodeFilter.FILTER_SKIP;
          }
          parent = parent.parentElement;
        }
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    }
  );

  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (/^\s*$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
      } else {
        const cleanWord = part.toLowerCase().replace(/^[.,!?;:"'()\u2018\u2019\u201c\u201d\u2014\u2013\u2026]+|[.,!?;:"'()\u2018\u2019\u201c\u201d\u2014\u2013\u2026]+$/g, '');
        if (!cleanWord) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          // Custom element avoids player CSS that targets overlay <span>s (extra gaps).
          const wordEl = document.createElement('npo-word');
          wordEl.dataset.word = cleanWord;
          wordEl.textContent = part;
          fragment.appendChild(wordEl);
        }
      }
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
};

const attachSubtitleClickListeners = (): void => {
  if (clickAbortController) return;
  const labelEl = document.querySelector<HTMLElement>(subtitleLabelSelector);
  if (!labelEl) return;

  injectSubtitlePointerStyles();

  clickAbortController = new AbortController();
  const { signal } = clickAbortController;

  labelEl.addEventListener('mouseover', (e: Event) => {
    if (!isAutoPauseEnabled) return;
    const mouseEvent = e as MouseEvent;
    const target = mouseEvent.target as HTMLElement | null;
    if (!target) return;
    const wordEl = target.closest('npo-word') as HTMLElement | null;
    if (!wordEl) return;

    const related = mouseEvent.relatedTarget as HTMLElement | null;
    if (related && wordEl.contains(related)) return;

    if (!isPausedByWordHover) {
      isPausedByWordHover = pauseVideoOnce();
    }
  }, { signal });

  // mouseleave only fires when leaving the overlay entirely (not word-to-word).
  labelEl.addEventListener('mouseleave', () => {
    if (!isAutoPauseEnabled || !isPausedByWordHover) return;
    const isTooltipOpen = Boolean(tooltipEl && tooltipEl.style.display !== 'none');
    if (isTooltipOpen) return;
    if (playVideoOnce()) {
      isPausedByWordHover = false;
    }
  }, { signal });

  labelEl.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'NPO-WORD') return;
    e.stopPropagation();
    const word = target.dataset.word;
    if (!word) return;
    currentClickedWord = word;
    if (isVideoPlaying()) {
      pauseVideoOnce();
    }
    if (wordTranslationCache.has(word)) {
      showTooltip(target, word, wordTranslationCache.get(word)!);
    } else {
      showTooltip(target, word, null);
      sendRuntimeMessage(
        { type: ChromeRuntimeMessageType.TranslateWord, payload: word } as ChromeRuntimeMessage,
        "translate-word"
      );
    }
  }, { signal });

  document.addEventListener('click', () => {
    hideTooltip();
  }, { signal });
};

const detachSubtitleClickListeners = (): void => {
  clickAbortController?.abort();
  clickAbortController = null;
  isPausedByWordHover = false;
  hideTooltip();
  removeSubtitlePointerStyles();
};

const startWordClick = (): void => {
  if (!wordClickWaitObserver) {
    // Keep watching the page so we can rebind when the player/subtitle overlay is recreated.
    wordClickWaitObserver = new MutationObserver(() => {
      const currentTarget = document.querySelector(subtitleOverlaySelector);
      if (currentTarget && currentTarget !== wordClickTargetNode) {
        startWordClick();
      }
    });
    wordClickWaitObserver.observe(document.body, { childList: true, subtree: true });
  }

  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) {
    log("word-click waiting for subtitle overlay");
    return;
  }

  if (wordClickObserver && wordClickTargetNode === targetNode) return;

  if (wordClickObserver) {
    wordClickObserver.disconnect();
    wordClickObserver = null;
  }

  wordClickTargetNode = targetNode;

  const tryWrap = (): void => {
    const labelEl = document.querySelector<HTMLElement>(subtitleLabelSelector);
    if (labelEl) {
      wrapWordsInSubtitle(labelEl);
      attachSubtitleClickListeners();
    }
  };

  tryWrap();

  wordClickObserver = new MutationObserver(() => {
    detachSubtitleClickListeners();
    tryWrap();
  });
  wordClickObserver.observe(targetNode, { childList: true, subtree: true, characterData: true });
};

const stopWordClick = (): void => {
  wordClickWaitObserver?.disconnect();
  wordClickWaitObserver = null;
  wordClickTargetNode = null;
  if (wordClickObserver) {
    wordClickObserver.disconnect();
    wordClickObserver = null;
  }
  detachSubtitleClickListeners();
};

const injectToggleButton = (controlbarRight: Element): void => {
  if (document.getElementById(toggleButtonId)) return;

  const btn = document.createElement('button');
  btn.id = toggleButtonId;
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Dual subtitles: off');
  btn.setAttribute('title', 'Toggle dual subtitles');

  // SVG as background-image data URI — same pattern all player buttons use
  const svgDataUri = "data:image/svg+xml;charset=utf-8,%3Csvg fill='none' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 260'%3E%3Cpath d='M120 70H245V185H215L235 245L155 185H120V70Z' fill='white' stroke='black' stroke-width='4' stroke-linejoin='round'/%3E%3Ctext x='145' y='150' font-family='Arial%2C sans-serif' font-size='60' font-weight='bold' fill='black'%3EEN%3C/text%3E%3Cpath d='M15 15H150V135H60L25 215V135H15V15Z' fill='%23FF7F00' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3Ctext x='22' y='95' font-family='Arial%2C sans-serif' font-size='55' font-weight='bold' fill='white'%3ENPO%3C/text%3E%3C/svg%3E";

  btn.style.background = 'transparent';
  btn.style.backgroundImage = `url("${svgDataUri}")`;
  btn.style.backgroundRepeat = 'no-repeat';
  btn.style.backgroundPosition = 'center';
  btn.style.backgroundSize = '24px';
  btn.style.border = 'none';
  btn.style.width = '24px';
  btn.style.height = '24px';
  btn.style.padding = '0';
  btn.style.margin = '0';
  btn.style.cursor = 'pointer';
  btn.style.filter = 'grayscale(1)';
  btn.style.opacity = '0.45';
  btn.style.transition = 'filter 0.2s, opacity 0.2s';
  btn.style.flexShrink = '0';
  btn.style.alignSelf = 'center';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isActivationInProgress) {
      log("ignoring click, activation already in progress");
      return;
    }
    if (isTranslationActive) {
      stopMonitoring();
      return;
    }
    isActivationInProgress = true;
    void activateWithSubtitles(false).finally(() => {
      finishActivation();
    });
  });

  controlbarRight.prepend(btn);
  updateToggleButtonState();
  log("injected toggle button");
};

const finishActivation = (): void => {
  isActivationInProgress = false;
  if (revalidateQueued) {
    revalidateQueued = false;
    void handleVideoNavigation();
  }
};

const resetCueState = (): void => {
  lastText = undefined;
  lastTranslatedText = undefined;
  wordTranslationCache.clear();
  hideTooltip();
  hideNoSubtitlesNotice();
};

const handleVideoNavigation = async (): Promise<void> => {
  resetCueState();
  if (isActivationInProgress) {
    revalidateQueued = true;
    log("queued subtitle revalidation for new video");
    return;
  }
  if (!isTranslationActive) {
    log("navigated while dual subtitles were off");
    return;
  }

  log("navigated while dual subtitles were on, checking this video");
  stopMonitoring();
  isActivationInProgress = true;
  updateToggleButtonPending(true);

  try {
    await waitFor(
      () => Boolean(document.querySelector(".npoplayer-settings-toggle-button")),
      5000
    );
    await delay(400);
    await activateWithSubtitles(true);
  } finally {
    finishActivation();
  }
};

const onLocationMaybeChanged = (): void => {
  const next = location.pathname + location.search;
  if (next === lastLocationKey) return;
  lastLocationKey = next;
  log("location changed", next);
  void handleVideoNavigation();
};

const watchLocationChanges = (): void => {
  const wrapHistoryMethod = (method: "pushState" | "replaceState"): void => {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History["pushState"]>) => {
      const result = original(...args);
      onLocationMaybeChanged();
      return result;
    };
  };
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("popstate", onLocationMaybeChanged);
};

const watchForPlayerContainer = (): void => {
  const tryInject = (): void => {
    onLocationMaybeChanged();
    const controlbar = document.querySelector(controlbarRightSelector);
    if (controlbar && !document.getElementById(toggleButtonId)) {
      injectToggleButton(controlbar);
    }
  };

  tryInject();

  if (!playerContainerObserver) {
    playerContainerObserver = new MutationObserver(tryInject);
    playerContainerObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.setTimeout(() => {
    if (!document.getElementById(toggleButtonId)) {
      logWarn("toggle button not injected after 5s");
      dumpPlayerHints();
    }
  }, 5000);
};

// Bootstrap
log("content script loaded", { href: location.href, isTopFrame: window === window.top });
safeStorageGet([storageKeyWordClickEnabled, storageKeyAutoPauseEnabled, 'selectedLanguage'], (data) => {
  if (data['selectedLanguage']) {
    currentSelectedLanguage = data['selectedLanguage'] as string;
  } else {
    safeStorageSet({ selectedLanguage: currentSelectedLanguage });
  }
  isAutoPauseEnabled = data[storageKeyAutoPauseEnabled] !== false;
  isWordClickEnabled = data[storageKeyWordClickEnabled] !== false;
  log("settings", { currentSelectedLanguage, isAutoPauseEnabled, isWordClickEnabled });
  if (isWordClickEnabled) {
    startWordClick();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if ('selectedLanguage' in changes && changes['selectedLanguage'].newValue) {
    currentSelectedLanguage = changes['selectedLanguage'].newValue as string;
  }
  if (storageKeyAutoPauseEnabled in changes) {
    isAutoPauseEnabled = changes[storageKeyAutoPauseEnabled].newValue !== false;
    if (!isAutoPauseEnabled) {
      if (isPausedByWordHover) {
        playVideoOnce();
      }
      isPausedByWordHover = false;
    }
  }
  if (storageKeyWordClickEnabled in changes) {
    isWordClickEnabled = changes[storageKeyWordClickEnabled].newValue === true;
    if (isWordClickEnabled) {
      startWordClick();
    } else {
      stopWordClick();
    }
  }
});

watchForPlayerContainer();
watchLocationChanges();
