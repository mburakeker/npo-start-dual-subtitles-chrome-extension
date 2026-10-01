import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import {
  playerRootSelector,
  subtitleLabelSelector,
  subtitleOverlaySelector,
  subtitlePointerStyleId,
  toggleButtonId,
} from "../player/constants";
import { log } from "../shared/log";
import { sendRuntimeMessage } from "../shared/messaging";
import {
  isVideoPlaying,
  pauseVideoOnce,
  playVideoOnce,
} from "../player/controls";
import { getResourceLinksForWord } from "./resources";
import { currentSelectedLanguage, isAutoPauseEnabled } from "../settings/state";
import {
  clickAbortController,
  currentClickedWord,
  isPausedByWordHover,
  setClickAbortController,
  setCurrentClickedWord,
  setPausedByWordHover,
  setTooltipEl,
  setWordClickObserver,
  setWordClickTargetNode,
  setWordClickWaitObserver,
  tooltipEl,
  wordClickObserver,
  wordClickTargetNode,
  wordClickWaitObserver,
  WordResult,
  wordTranslationCache,
} from "./state";

const injectSubtitlePointerStyles = (): void => {
  if (document.getElementById(subtitlePointerStyleId)) return;
  const style = document.createElement("style");
  style.id = subtitlePointerStyleId;
  const tooltipCss = [
    "#npo-word-tooltip { position:fixed; display:none; z-index:2147483647; background:#1a1a2e; color:#e8e8e8; font-family:Arial,sans-serif; border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.65),0 2px 8px rgba(0,0,0,0.4); min-width:300px; max-width:420px; pointer-events:auto; border:1px solid rgba(255,255,255,0.12); overflow:hidden; user-select:text; -webkit-user-select:text; }",
    ".npo-tt-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px 8px; background:rgba(255,255,255,0.07); border-bottom:1px solid rgba(255,255,255,0.1); }",
    ".npo-tt-word { font-size:16px; font-weight:bold; color:#fff; letter-spacing:0.03em; }",
    ".npo-tt-close { all:unset; cursor:pointer; color:rgba(255,255,255,0.5); font-size:20px; line-height:1; padding:0 2px; border-radius:3px; }",
    ".npo-tt-close:hover { color:#fff; }",
    ".npo-tt-section { padding:8px 14px 10px; border-bottom:1px solid rgba(255,255,255,0.07); }",
    ".npo-tt-section:last-child { border-bottom:none; }",
    ".npo-tt-label { font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:rgba(255,255,255,0.45); margin-bottom:4px; }",
    ".npo-tt-text { font-size:14px; line-height:1.55; color:#e8e8e8; word-break:break-word; white-space:pre-line; user-select:text; -webkit-user-select:text; cursor:text; }",
    ".npo-tt-not-found { color:rgba(255,255,255,0.35); font-style:italic; }",
    ".npo-tt-attribution-inline { font-size:10px; color:rgba(255,255,255,0.4); text-decoration:none; font-weight:normal; text-transform:none; letter-spacing:0; }",
    ".npo-tt-attribution-inline:hover { color:rgba(255,255,255,0.7); }",
    ".npo-tt-links { display:flex; flex-wrap:wrap; gap:6px; }",
    ".npo-tt-link { font-size:11px; color:#9cc9ff; text-decoration:none; border:1px solid rgba(156,201,255,0.25); border-radius:999px; padding:3px 8px; }",
    ".npo-tt-link:hover { color:#d6e9ff; border-color:rgba(214,233,255,0.55); }",
  ];
  style.textContent = [
    `${playerRootSelector} .npoplayer-subtitle-overlay { z-index: 20 !important; pointer-events: none !important; }`,
    `${playerRootSelector} .npoplayer-subtitle-overlay npo-word { display: inline !important; margin: 0 !important; padding: 0 !important; border: none !important; font: inherit !important; font-size: inherit !important; line-height: inherit !important; letter-spacing: inherit !important; word-spacing: inherit !important; color: inherit !important; background: transparent !important; pointer-events: auto !important; cursor: pointer !important; text-decoration: underline dotted rgba(255,255,255,0.55) !important; }`,
    `${playerRootSelector} .npoplayer-settings-panel { z-index: 30 !important; pointer-events: auto !important; }`,
    `${playerRootSelector}:has(.npoplayer-settings-panel:not(.npoplayer-hidden)) .npoplayer-subtitle-overlay npo-word { pointer-events: none !important; }`,
    ...tooltipCss,
  ].join("\n");
  document.head.appendChild(style);
};

const removeSubtitlePointerStyles = (): void => {
  document.getElementById(subtitlePointerStyleId)?.remove();
};

const getOrCreateTooltip = (host?: HTMLElement): HTMLElement => {
  if (!tooltipEl) {
    const el = document.createElement("div");
    el.id = "npo-word-tooltip";
    el.addEventListener("click", (e) => e.stopPropagation());
    (host ?? document.body).appendChild(el);
    setTooltipEl(el);
  } else if (host && tooltipEl.parentElement !== host) {
    host.appendChild(tooltipEl);
  }
  return tooltipEl!;
};

const renderTooltipContent = (tip: HTMLElement, word: string, result: WordResult | null): void => {
  tip.innerHTML = "";

  const header = document.createElement("div");
  header.className = "npo-tt-header";
  const wordSpan = document.createElement("span");
  wordSpan.className = "npo-tt-word";
  wordSpan.textContent = word;
  const closeBtn = document.createElement("button");
  closeBtn.className = "npo-tt-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideTooltip();
  });
  header.appendChild(wordSpan);
  header.appendChild(closeBtn);
  tip.appendChild(header);

  const makeSection = (label: string, value: string | null | undefined): void => {
    const section = document.createElement("div");
    section.className = "npo-tt-section";
    const lbl = document.createElement("div");
    lbl.className = "npo-tt-label";
    lbl.textContent = label;
    const txt = document.createElement("div");
    txt.className = "npo-tt-text";
    if (value === undefined) {
      txt.textContent = "\u2026";
    } else if (value) {
      txt.textContent = value;
    } else {
      txt.textContent = "Not found";
      txt.classList.add("npo-tt-not-found");
    }
    section.appendChild(lbl);
    section.appendChild(txt);
    tip.appendChild(section);
  };

  makeSection("Dictionary (Wiktionary)", result === null ? undefined : result.wiktionary);

  const gtSection = document.createElement("div");
  gtSection.className = "npo-tt-section";
  const gtLabel = document.createElement("div");
  gtLabel.className = "npo-tt-label";
  const gtLabelText = document.createElement("span");
  gtLabelText.textContent = "Translation (";
  const gtAttrLink = document.createElement("a");
  gtAttrLink.className = "npo-tt-attribution npo-tt-attribution-inline";
  gtAttrLink.href = "https://translate.google.com";
  gtAttrLink.target = "_blank";
  gtAttrLink.rel = "noopener noreferrer";
  gtAttrLink.textContent = "Powered by Google Translate";
  const gtLabelEnd = document.createElement("span");
  gtLabelEnd.textContent = ")";
  gtLabel.appendChild(gtLabelText);
  gtLabel.appendChild(gtAttrLink);
  gtLabel.appendChild(gtLabelEnd);
  const gtTxt = document.createElement("div");
  gtTxt.className = "npo-tt-text";
  const gtValue = result === null ? undefined : result.googleTranslate;
  if (gtValue === undefined) {
    gtTxt.textContent = "\u2026";
  } else if (gtValue) {
    gtTxt.textContent = gtValue;
  } else {
    gtTxt.textContent = "Not found";
    gtTxt.classList.add("npo-tt-not-found");
  }
  gtSection.appendChild(gtLabel);
  gtSection.appendChild(gtTxt);
  tip.appendChild(gtSection);

  const linksSection = document.createElement("div");
  linksSection.className = "npo-tt-section";
  const linksLabel = document.createElement("div");
  linksLabel.className = "npo-tt-label";
  linksLabel.textContent = "Learn More";
  const linksContainer = document.createElement("div");
  linksContainer.className = "npo-tt-links";
  const links = getResourceLinksForWord(word, currentSelectedLanguage);
  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.className = "npo-tt-link";
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
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
  tip.style.display = "block";
  positionTooltip(tip, wordEl);
};

const isTooltipVisible = (): boolean => {
  return Boolean(tooltipEl && tooltipEl.style.display !== "none");
};

export const applyWordResult = (word: string, result: WordResult): void => {
  wordTranslationCache.set(word, result);
  if (word !== currentClickedWord) return;

  const wordEl = document.querySelector<HTMLElement>(`npo-word[data-word="${CSS.escape(word)}"]`);
  if (!tooltipEl || !isTooltipVisible()) {
    if (wordEl) showTooltip(wordEl, word, result);
    return;
  }
  renderTooltipContent(tooltipEl, word, result);
  if (wordEl) positionTooltip(tooltipEl, wordEl);
};

export const hideTooltip = (): void => {
  if (tooltipEl) tooltipEl.style.display = "none";
  setCurrentClickedWord(null);
};

const wrapWordsInSubtitle = (subtitleLabel: HTMLElement): void => {
  if (subtitleLabel.querySelector("npo-word")) return;

  const walker = document.createTreeWalker(subtitleLabel, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      let parent = node.parentElement;
      while (parent && parent !== subtitleLabel) {
        if (parent.classList.contains("translated") || parent.tagName === "NPO-WORD") {
          return NodeFilter.FILTER_SKIP;
        }
        parent = parent.parentElement;
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (/^\s*$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
      } else {
        const cleanWord = part
          .toLowerCase()
          .replace(/^[.,!?;:"'()\u2018\u2019\u201c\u201d\u2014\u2013\u2026]+|[.,!?;:"'()\u2018\u2019\u201c\u201d\u2014\u2013\u2026]+$/g, "");
        if (!cleanWord) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const wordEl = document.createElement("npo-word");
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

  const controller = new AbortController();
  setClickAbortController(controller);
  const { signal } = controller;

  labelEl.addEventListener(
    "mouseover",
    (e: Event) => {
      if (!isAutoPauseEnabled) return;
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement | null;
      if (!target) return;
      const wordEl = target.closest("npo-word") as HTMLElement | null;
      if (!wordEl) return;

      const related = mouseEvent.relatedTarget as HTMLElement | null;
      if (related && wordEl.contains(related)) return;

      if (!isPausedByWordHover) {
        setPausedByWordHover(pauseVideoOnce());
      }
    },
    { signal }
  );

  labelEl.addEventListener(
    "mouseleave",
    () => {
      if (!isAutoPauseEnabled || !isPausedByWordHover) return;
      const isTooltipOpen = Boolean(tooltipEl && tooltipEl.style.display !== "none");
      if (isTooltipOpen) return;
      if (playVideoOnce()) {
        setPausedByWordHover(false);
      }
    },
    { signal }
  );

  labelEl.addEventListener(
    "click",
    (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "NPO-WORD") return;
      e.preventDefault();
      e.stopPropagation();
      const word = target.dataset.word;
      if (!word) return;
      setCurrentClickedWord(word);
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
    },
    { signal }
  );

  document.addEventListener(
    "click",
    (e: Event) => {
      if (!e.isTrusted) return;
      const target = e.target as Element | null;
      if (target?.closest?.(`#npo-word-tooltip, npo-word, #${toggleButtonId}`)) return;
      hideTooltip();
    },
    { signal }
  );
};

const detachSubtitleClickListeners = (options?: { keepTooltip?: boolean }): void => {
  clickAbortController?.abort();
  setClickAbortController(null);
  setPausedByWordHover(false);
  if (!options?.keepTooltip) {
    hideTooltip();
  }
  removeSubtitlePointerStyles();
};

export const startWordClick = (): void => {
  if (!wordClickWaitObserver) {
    const waitObserver = new MutationObserver(() => {
      const currentTarget = document.querySelector(subtitleOverlaySelector);
      if (currentTarget && currentTarget !== wordClickTargetNode) {
        startWordClick();
      }
    });
    setWordClickWaitObserver(waitObserver);
    waitObserver.observe(document.body, { childList: true, subtree: true });
  }

  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) {
    log("word-click waiting for subtitle overlay");
    return;
  }

  if (wordClickObserver && wordClickTargetNode === targetNode) return;

  if (wordClickObserver) {
    wordClickObserver.disconnect();
    setWordClickObserver(null);
  }
  detachSubtitleClickListeners({ keepTooltip: true });

  setWordClickTargetNode(targetNode);

  const tryWrap = (): void => {
    const labelEl = document.querySelector<HTMLElement>(subtitleLabelSelector);
    if (labelEl) {
      wrapWordsInSubtitle(labelEl);
      attachSubtitleClickListeners();
    }
  };

  tryWrap();

  const observer = new MutationObserver(() => {
    detachSubtitleClickListeners({ keepTooltip: true });
    tryWrap();
  });
  setWordClickObserver(observer);
  observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
};

export const stopWordClick = (): void => {
  wordClickWaitObserver?.disconnect();
  setWordClickWaitObserver(null);
  setWordClickTargetNode(null);
  if (wordClickObserver) {
    wordClickObserver.disconnect();
    setWordClickObserver(null);
  }
  detachSubtitleClickListeners();
};
