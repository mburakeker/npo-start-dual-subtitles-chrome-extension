export type WordResult = { wiktionary: string | null; googleTranslate: string | null };

export const wordTranslationCache = new Map<string, WordResult>();
export let currentClickedWord: string | null = null;
export let tooltipEl: HTMLElement | null = null;
export let clickAbortController: AbortController | null = null;
export let wordClickObserver: MutationObserver | null = null;
export let wordClickWaitObserver: MutationObserver | null = null;
export let wordClickTargetNode: Element | null = null;
export let isPausedByWordHover = false;

export const setCurrentClickedWord = (word: string | null): void => {
  currentClickedWord = word;
};

export const setTooltipEl = (el: HTMLElement | null): void => {
  tooltipEl = el;
};

export const setClickAbortController = (controller: AbortController | null): void => {
  clickAbortController = controller;
};

export const setWordClickTargetNode = (node: Element | null): void => {
  wordClickTargetNode = node;
};

export const setPausedByWordHover = (value: boolean): void => {
  isPausedByWordHover = value;
};

export const setWordClickObserver = (observer: MutationObserver | null): void => {
  wordClickObserver = observer;
};

export const setWordClickWaitObserver = (observer: MutationObserver | null): void => {
  wordClickWaitObserver = observer;
};
