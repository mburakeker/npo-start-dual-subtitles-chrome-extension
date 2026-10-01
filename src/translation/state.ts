import { CueTranslationCache } from "../cues/cache";
import { CUE_TRANSLATION_CACHE_MAX } from "../player/constants";

export let lastText: string | undefined;
export let lastTranslatedText: string | undefined;
/** Bumped on every new cue translate request; replies with an older id are ignored. */
export let cueTranslationRequestId = 0;
/** Dutch cue text → translated text (includes prefetched upcoming cues). */
export const cueTranslationCache = new CueTranslationCache(CUE_TRANSLATION_CACHE_MAX);
let lastPrefetchScanAt = 0;
export let isTranslationActive = false;

export const getLastPrefetchScanAt = (): number => lastPrefetchScanAt;
export const setLastPrefetchScanAt = (value: number): void => {
  lastPrefetchScanAt = value;
};

export const bumpCueTranslationRequestId = (): number => {
  cueTranslationRequestId += 1;
  return cueTranslationRequestId;
};

export const setLastText = (value: string | undefined): void => {
  lastText = value;
};

export const setLastTranslatedText = (value: string | undefined): void => {
  lastTranslatedText = value;
};

export const setTranslationActive = (active: boolean): void => {
  isTranslationActive = active;
};
