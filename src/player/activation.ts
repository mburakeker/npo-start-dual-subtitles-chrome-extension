import {
  clickSettingsButton,
  closeSettingsPanel,
  isDutchSubtitleAlreadyOn,
  openSubtitleSettings,
  turnOnSubtitles,
} from "./onboarding";
import { subtitleOverlaySelector } from "./constants";
import { delay, waitFor } from "../shared/dom-utils";
import { log, logWarn } from "../shared/log";
import { dumpPlayerHints } from "./controls";
import { hideNoSubtitlesNotice, showNoSubtitlesNotice, updateToggleButtonPending } from "../ui/toggle";
import {
  isActivationInProgress,
  revalidateQueued,
  setActivationInProgress,
  setRevalidateQueued,
} from "../ui/state";
import { isTranslationActive } from "../translation/state";
import { wordTranslationCache } from "../words/state";
import { hideTooltip } from "../words/click";
import {
  bumpCueTranslationRequestId,
  setLastText,
  setLastTranslatedText,
} from "../translation/state";
import { clearCueTranslationCache } from "../translation/pipeline";
import { startMonitoring, stopMonitoring } from "../cues/monitor";

export const finishActivation = (): void => {
  setActivationInProgress(false);
  if (revalidateQueued) {
    setRevalidateQueued(false);
    void handleVideoNavigation();
  }
};

export const activateWithSubtitles = async (silent = false): Promise<void> => {
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

export const resetCueState = (): void => {
  setLastText(undefined);
  setLastTranslatedText(undefined);
  bumpCueTranslationRequestId();
  clearCueTranslationCache();
  wordTranslationCache.clear();
  hideTooltip();
  hideNoSubtitlesNotice();
};

export const handleVideoNavigation = async (): Promise<void> => {
  resetCueState();
  if (isActivationInProgress) {
    setRevalidateQueued(true);
    log("queued subtitle revalidation for new video");
    return;
  }
  if (!isTranslationActive) {
    log("navigated while dual subtitles were off");
    return;
  }

  log("navigated while dual subtitles were on, checking this video");
  stopMonitoring();
  setActivationInProgress(true);
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
