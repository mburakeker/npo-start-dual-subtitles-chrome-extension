import { clickSettingsButton, openSubtitleSettings, turnOnSubtitles } from "./onboarding-helper";
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
let subtitleSelectionAbortController: AbortController | null = null;
let isPausedBySubtitleHover = false;
let isPausedByWordHover = false;
const storageKeyWordClickEnabled = "wordClickEnabled";
const storageKeySubtitleSelectionEnabled = "subtitleSelectionEnabled";
const storageKeyAutoPauseEnabled = "autoPauseEnabled";
let currentSelectedLanguage = "en";
let isSubtitleSelectionModeActive = false;
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
chrome.runtime.onMessage.addListener((req: ChromeRuntimeMessage) => {
  if (req.type === ChromeRuntimeMessageType.TranslateFinished && req.payload) {
    addTranslatedSubtitle(req.payload);
    lastTranslatedText = req.payload;
  }
  if (req.type === ChromeRuntimeMessageType.TranslateWordFinished && req.payload) {
    const parsed = JSON.parse(req.payload) as { word: string; wiktionary: string | null; googleTranslate: string | null };
    const result: WordResult = { wiktionary: parsed.wiktionary, googleTranslate: parsed.googleTranslate };
    wordTranslationCache.set(parsed.word, result);
    if (parsed.word === currentClickedWord) {
      updateTooltipContent(result);
    }
  }
});

// Functions
const startMonitoring = (): void => {
  isTranslationActive = true;
  safeStorageSet({ [storageKeyTranslationEnabled]: true });
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
  safeStorageSet({ [storageKeyTranslationEnabled]: false });
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
  newSpan.setAttribute("lang", `${currentSelectedLanguage}-x-mtfrom-nl`);
  return newSpan;
}

const insertTranslatedSpan = (parent: HTMLElement, newSpan: HTMLElement): void => {
  const br = document.createElement("br");
  parent.insertBefore(br, parent.firstChild);
  parent.insertBefore(newSpan, parent.firstChild);
}

const subtitlePointerStyleId = 'npo-subtitle-pointer-styles';

const injectSubtitlePointerStyles = (): void => {
  if (document.getElementById(subtitlePointerStyleId)) return;
  const style = document.createElement('style');
  style.id = subtitlePointerStyleId;
  // The player CSS sets pointer-events:none on .bmpui-ui-subtitle-overlay and
  // all: unset on its children, which makes pointer-events inherit as none.
  // We override that here so our .npo-word spans can receive mouse events.
  // .bmpui-ui-playbacktoggle-overlay is a later DOM sibling so it stacks on top of
  // .bmpui-ui-subtitle-overlay and intercepts all clicks by default.
  // Fix: raise the subtitle overlay above it via z-index (the overlay already has
  // position:absolute from the player CSS, so z-index takes effect).
  // Keep pointer-events:none on the overlay itself so non-text clicks fall through to
  // the playback toggle overlay below — only the label and .npo-word spans are targets.
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
    '.bmpui-ui-uicontainer .bmpui-ui-subtitle-overlay { z-index: 10 !important; pointer-events: none !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-subtitle-overlay .bmpui-ui-subtitle-label { pointer-events: auto !important; cursor: default !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-settings-panel, .bmpui-ui-uicontainer .bmpui-ui-settings-panel-page { z-index: 30 !important; pointer-events: auto !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-settingspanelpageopenbutton.bmpui-listbox-pager-button { z-index: 31 !important; pointer-events: auto !important; }',
    '.bmpui-ui-uicontainer:has(.bmpui-ui-settingstogglebutton.bmpui-on) .bmpui-ui-subtitle-overlay .bmpui-ui-subtitle-label { pointer-events: none !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-subtitle-overlay .npo-word { pointer-events: auto !important; cursor: pointer !important; text-decoration: underline dotted rgba(255,255,255,0.55) !important; }',
    ...tooltipCss,
  ].join('\n');
  document.head.appendChild(style);
};

const removeSubtitlePointerStyles = (): void => {
  document.getElementById(subtitlePointerStyleId)?.remove();
};

const subtitleSelectionStyleId = 'npo-subtitle-selection-styles';

const injectSubtitleSelectionStyles = (): void => {
  if (document.getElementById(subtitleSelectionStyleId)) return;
  const style = document.createElement('style');
  style.id = subtitleSelectionStyleId;
  style.textContent = [
    '.bmpui-ui-uicontainer .bmpui-ui-subtitle-overlay { z-index: 10 !important; pointer-events: none !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-subtitle-overlay .bmpui-ui-subtitle-label { pointer-events: auto !important; user-select: text !important; -webkit-user-select: text !important; cursor: text !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-settings-panel, .bmpui-ui-uicontainer .bmpui-ui-settings-panel-page { z-index: 30 !important; pointer-events: auto !important; user-select: none !important; -webkit-user-select: none !important; }',
    '.bmpui-ui-uicontainer .bmpui-ui-settingspanelpageopenbutton.bmpui-listbox-pager-button, .bmpui-ui-uicontainer .bmpui-ui-settings-trigger, .bmpui-ui-uicontainer .bmpui-ui-settingstogglebutton { z-index: 31 !important; pointer-events: auto !important; cursor: pointer !important; user-select: none !important; -webkit-user-select: none !important; }',
    '.bmpui-ui-uicontainer:has(.bmpui-ui-settingstogglebutton.bmpui-on) .bmpui-ui-subtitle-overlay .bmpui-ui-subtitle-label { pointer-events: none !important; }',
  ].join('\n');
  document.head.appendChild(style);
};

const removeSubtitleSelectionStyles = (): void => {
  document.getElementById(subtitleSelectionStyleId)?.remove();
};

const startSubtitleSelectionMode = (): void => {
  if (isSubtitleSelectionModeActive) return;
  isSubtitleSelectionModeActive = true;
  stopWordClick();
  injectSubtitleSelectionStyles();

  subtitleSelectionAbortController = new AbortController();
  const { signal } = subtitleSelectionAbortController;
  document.addEventListener('mouseover', (e: Event) => {
    if (!isAutoPauseEnabled) return;
    const mouseEvent = e as MouseEvent;
    const target = mouseEvent.target as HTMLElement | null;
    if (!target) return;

    const label = target.closest(subtitleLabelSelector) as HTMLElement | null;
    if (!label) return;

    const related = mouseEvent.relatedTarget as HTMLElement | null;
    if (related && label.contains(related)) return;

    if (!isPausedBySubtitleHover) {
      isPausedBySubtitleHover = pauseVideoOnce();
    }
  }, { signal });

  document.addEventListener('mouseout', (e: Event) => {
    if (!isAutoPauseEnabled) return;
    const mouseEvent = e as MouseEvent;
    const target = mouseEvent.target as HTMLElement | null;
    if (!target) return;

    const label = target.closest(subtitleLabelSelector) as HTMLElement | null;
    if (!label) return;

    const related = mouseEvent.relatedTarget as HTMLElement | null;
    if (related && label.contains(related)) return;

    if (isPausedBySubtitleHover) {
      const resumed = playVideoOnce();
      if (resumed) {
        isPausedBySubtitleHover = false;
      }
    }
  }, { signal });
};

const stopSubtitleSelectionMode = (): void => {
  if (!isSubtitleSelectionModeActive) return;
  isSubtitleSelectionModeActive = false;
  isPausedBySubtitleHover = false;
  subtitleSelectionAbortController?.abort();
  subtitleSelectionAbortController = null;
  removeSubtitleSelectionStyles();
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
  const host = wordEl.closest('.bmpui-ui-uicontainer') as HTMLElement | null;
  const tip = getOrCreateTooltip(host ?? undefined);
  renderTooltipContent(tip, word, result);
  tip.style.display = 'block';
  positionTooltip(tip, wordEl);
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
  const btn =
    document.querySelector<HTMLElement>('.bmpui-ui-playbacktogglebutton.bmpui-on') ||
    document.querySelector<HTMLElement>('.bmpui-ui-hugeplaybacktogglebutton.bmpui-on') ||
    document.querySelector<HTMLElement>('.bmpui-ui-playbacktogglebutton') ||
    document.querySelector<HTMLElement>('.bmpui-ui-hugeplaybacktogglebutton');
  // Use bubbles:false so this programmatic click does not propagate to the document
  // listener that dismisses the tooltip.
  if (!btn) return false;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
  return true;
};

const playVideoOnce = (): boolean => {
  const btn =
    document.querySelector<HTMLElement>('.bmpui-ui-playbacktogglebutton:not(.bmpui-on)') ||
    document.querySelector<HTMLElement>('.bmpui-ui-hugeplaybacktogglebutton:not(.bmpui-on)') ||
    document.querySelector<HTMLElement>('.bmpui-ui-playbacktogglebutton') ||
    document.querySelector<HTMLElement>('.bmpui-ui-hugeplaybacktogglebutton');
  if (!btn) return false;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
  return true;
};

const isVideoPlaying = (): boolean => {
  return Boolean(
    document.querySelector('.bmpui-ui-playbacktogglebutton.bmpui-on') ||
    document.querySelector('.bmpui-ui-hugeplaybacktogglebutton.bmpui-on')
  );
};

const wrapWordsInSubtitle = (subtitleLabel: HTMLElement): void => {
  if (subtitleLabel.querySelector('.npo-word')) return;

  const walker = document.createTreeWalker(
    subtitleLabel,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node): number {
        let parent = node.parentElement;
        while (parent && parent !== subtitleLabel) {
          if (parent.classList.contains('translated') || parent.classList.contains('npo-word')) {
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
          const span = document.createElement('span');
          span.className = 'npo-word';
          span.dataset.word = cleanWord;
          span.textContent = part;
          fragment.appendChild(span);
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
    const wordEl = target.closest('.npo-word') as HTMLElement | null;
    if (!wordEl) return;

    const related = mouseEvent.relatedTarget as HTMLElement | null;
    if (related && wordEl.contains(related)) return;

    if (!isPausedByWordHover) {
      isPausedByWordHover = pauseVideoOnce();
    }
  }, { signal });

  labelEl.addEventListener('mouseout', (e: Event) => {
    if (!isAutoPauseEnabled) return;
    const mouseEvent = e as MouseEvent;
    const target = mouseEvent.target as HTMLElement | null;
    if (!target) return;
    const wordEl = target.closest('.npo-word') as HTMLElement | null;
    if (!wordEl) return;

    const related = mouseEvent.relatedTarget as HTMLElement | null;
    if (related && wordEl.contains(related)) return;
    if (related && labelEl.contains(related)) return;

    // When moving across text gaps, relatedTarget can be null; keep paused if the
    // pointer is still within the subtitle label's box.
    const rect = labelEl.getBoundingClientRect();
    const isStillInsideLabel =
      mouseEvent.clientX >= rect.left &&
      mouseEvent.clientX <= rect.right &&
      mouseEvent.clientY >= rect.top &&
      mouseEvent.clientY <= rect.bottom;
    if (isStillInsideLabel) return;

    const isTooltipOpen = Boolean(tooltipEl && tooltipEl.style.display !== 'none');
    if (!isTooltipOpen && isPausedByWordHover) {
      const resumed = playVideoOnce();
      if (resumed) {
        isPausedByWordHover = false;
      }
    }
  }, { signal });

  labelEl.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('npo-word')) return;
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
      chrome.runtime.sendMessage({ type: ChromeRuntimeMessageType.TranslateWord, payload: word } as ChromeRuntimeMessage);
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

// Bootstrap
safeStorageGet([storageKeyWordClickEnabled, storageKeySubtitleSelectionEnabled, storageKeyAutoPauseEnabled, 'selectedLanguage'], (data) => {
  if (data['selectedLanguage']) currentSelectedLanguage = data['selectedLanguage'] as string;
  isAutoPauseEnabled = data[storageKeyAutoPauseEnabled] !== false;
  isWordClickEnabled = data[storageKeyWordClickEnabled] !== false;
  const isSubtitleSelectionEnabled = data[storageKeySubtitleSelectionEnabled] === true;
  if (isSubtitleSelectionEnabled) {
    startSubtitleSelectionMode();
  } else if (isWordClickEnabled) {
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
      if (isPausedByWordHover || isPausedBySubtitleHover) {
        playVideoOnce();
      }
      isPausedByWordHover = false;
      isPausedBySubtitleHover = false;
    }
  }
  if (storageKeyWordClickEnabled in changes) {
    isWordClickEnabled = changes[storageKeyWordClickEnabled].newValue === true;
  }
  if (storageKeyWordClickEnabled in changes || storageKeySubtitleSelectionEnabled in changes) {
    const subtitleSelectionEnabled =
      storageKeySubtitleSelectionEnabled in changes
        ? changes[storageKeySubtitleSelectionEnabled].newValue === true
        : isSubtitleSelectionModeActive;

    if (subtitleSelectionEnabled) {
      startSubtitleSelectionMode();
      stopWordClick();
    } else if (isWordClickEnabled) {
      stopSubtitleSelectionMode();
      startWordClick();
    } else {
      stopSubtitleSelectionMode();
      stopWordClick();
    }
  }
});

watchForPlayerContainer();
