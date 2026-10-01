import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "../shared/types";
import { PREFETCH_AHEAD, PREFETCH_SCAN_MIN_INTERVAL_MS } from "../player/constants";
import {
  getUpcomingCueTexts,
  normalizeCueText,
  getSubtitleOverlayElement,
} from "../cues/text";
import { addTranslatedSubtitle } from "../cues/overlay";
import { log } from "../shared/log";
import { sendRuntimeMessage } from "../shared/messaging";
import {
  bumpCueTranslationRequestId,
  cueTranslationCache,
  getLastPrefetchScanAt,
  isTranslationActive,
  lastText,
  lastTranslatedText,
  setLastPrefetchScanAt,
  setLastText,
  setLastTranslatedText,
} from "./state";
import { cueTextTrack, cueTextTrackVideo } from "../cues/monitor-state";

export const clearCueTranslationCache = (): void => {
  cueTranslationCache.clear();
};

export const cacheCueTranslationFromMessage = (dutch: string, translated: string): void => {
  cueTranslationCache.set(dutch, translated);
};

const prefetchCueTranslation = (text: string): void => {
  if (!isTranslationActive || !text) return;
  if (cueTranslationCache.has(text) || cueTranslationCache.isInFlight(text)) return;
  cueTranslationCache.markInFlight(text);
  sendRuntimeMessage(
    {
      type: ChromeRuntimeMessageType.Translate,
      payload: text,
      sourceText: text,
      prefetch: true,
    } as ChromeRuntimeMessage,
    "translate-prefetch"
  );
};

export const prefetchUpcomingCues = (): void => {
  if (!isTranslationActive || !cueTextTrack || !cueTextTrackVideo) return;
  const upcoming = getUpcomingCueTexts(cueTextTrack, cueTextTrackVideo.currentTime, PREFETCH_AHEAD);
  if (upcoming.length === 0) return;
  log("prefetching upcoming cues", {
    count: upcoming.length,
    preview: upcoming[0]?.slice(0, 40),
  });
  for (const text of upcoming) prefetchCueTranslation(text);
};

export const onVideoTimeUpdateForPrefetch = (): void => {
  const now = Date.now();
  if (now - getLastPrefetchScanAt() < PREFETCH_SCAN_MIN_INTERVAL_MS) return;
  setLastPrefetchScanAt(now);
  prefetchUpcomingCues();
};

export const requestCueTranslation = (rawText: string, source: "texttrack" | "dom"): void => {
  if (!isTranslationActive) return;
  const textToTranslate = normalizeCueText(rawText);
  if (!textToTranslate) return;

  const subtitleParentElement = getSubtitleOverlayElement();

  if (textToTranslate === lastText && lastTranslatedText !== undefined) {
    if (subtitleParentElement && !subtitleParentElement.querySelector(".translated")) {
      addTranslatedSubtitle(lastTranslatedText);
    }
    return;
  }

  const cached = cueTranslationCache.get(textToTranslate);
  if (cached !== undefined) {
    log("using prefetched translation", { source, preview: textToTranslate.slice(0, 80) });
    bumpCueTranslationRequestId();
    setLastText(textToTranslate);
    setLastTranslatedText(cached);
    addTranslatedSubtitle(cached);
    prefetchUpcomingCues();
    return;
  }

  subtitleParentElement?.querySelectorAll(".translated").forEach((el) => el.remove());
  log("translating cue", { source, preview: textToTranslate.slice(0, 80) });
  const requestId = bumpCueTranslationRequestId();
  setLastText(textToTranslate);
  setLastTranslatedText(undefined);
  cueTranslationCache.markInFlight(textToTranslate);
  sendRuntimeMessage(
    {
      type: ChromeRuntimeMessageType.Translate,
      payload: textToTranslate,
      sourceText: textToTranslate,
      requestId,
    } as ChromeRuntimeMessage,
    "translate"
  );
  prefetchUpcomingCues();
};

export const invalidateInFlightTranslations = (): void => {
  bumpCueTranslationRequestId();
};
