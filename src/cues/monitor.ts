import { subtitleLabelSelector, subtitleOverlaySelector } from "../player/constants";
import { storageKeyTranslationEnabled } from "../settings/keys";
import {
  getActiveCueText,
  getDutchSubtitleText,
  findDutchTextTrack,
} from "./text";
import { log } from "../shared/log";
import { safeStorageSet } from "../shared/storage";
import {
  bumpCueTranslationRequestId,
  isTranslationActive,
  lastText,
  lastTranslatedText,
  setTranslationActive,
} from "../translation/state";
import {
  clearCueTranslationCache,
  prefetchUpcomingCues,
  requestCueTranslation,
  onVideoTimeUpdateForPrefetch,
} from "../translation/pipeline";
import { addTranslatedSubtitle } from "./overlay";
import {
  cueTextTrack,
  cueTextTrackVideo,
  setCueTextTrack,
  setCueTextTrackVideo,
  setTextTracksList,
  setTranslationObserver,
  setTranslationTargetNode,
  setTranslationWaitObserver,
  textTracksList,
  translationObserver,
  translationTargetNode,
  translationWaitObserver,
} from "./monitor-state";
import { getPlayerVideo } from "../player/controls";
import { hideNoSubtitlesNotice, updateToggleButtonState } from "../ui/toggle";

export const startMonitoring = (): void => {
  setTranslationActive(true);
  safeStorageSet({ [storageKeyTranslationEnabled]: true });
  hideNoSubtitlesNotice();
  updateToggleButtonState();
  const textTrackAttached = attachTextTrackCueSource();
  log("primary cue source", textTrackAttached ? "texttrack" : "dom (texttrack unavailable)");
  monitorDomChanges();
};

export const stopMonitoring = (): void => {
  log("stopping dual subtitles");
  setTranslationActive(false);
  bumpCueTranslationRequestId();
  clearCueTranslationCache();
  safeStorageSet({ [storageKeyTranslationEnabled]: false });
  detachTextTrackCueSource();
  translationWaitObserver?.disconnect();
  setTranslationWaitObserver(null);
  setTranslationTargetNode(null);
  if (translationObserver) {
    translationObserver.disconnect();
    setTranslationObserver(null);
  }
  updateToggleButtonState();
};

const onTextTrackCueChange = (): void => {
  if (!isTranslationActive || !cueTextTrack) return;
  const text = getActiveCueText(cueTextTrack);
  if (text) requestCueTranslation(text, "texttrack");
  prefetchUpcomingCues();
};

const onTextTracksChanged = (): void => {
  if (!isTranslationActive) return;
  attachTextTrackCueSource();
};

const detachTextTrackCueSource = (): void => {
  if (cueTextTrackVideo) {
    cueTextTrackVideo.removeEventListener("timeupdate", onVideoTimeUpdateForPrefetch);
  }
  if (cueTextTrack) {
    cueTextTrack.removeEventListener("cuechange", onTextTrackCueChange);
    setCueTextTrack(null);
  }
  if (textTracksList) {
    textTracksList.removeEventListener("addtrack", onTextTracksChanged);
    textTracksList.removeEventListener("change", onTextTracksChanged);
    setTextTracksList(null);
  }
  setCueTextTrackVideo(null);
};

const attachTextTrackCueSource = (): boolean => {
  const video = getPlayerVideo();
  if (!video) return false;

  if (cueTextTrackVideo !== video) {
    detachTextTrackCueSource();
    setCueTextTrackVideo(video);
    setTextTracksList(video.textTracks);
    video.textTracks.addEventListener("addtrack", onTextTracksChanged);
    video.textTracks.addEventListener("change", onTextTracksChanged);
    video.addEventListener("timeupdate", onVideoTimeUpdateForPrefetch);
  }

  const track = findDutchTextTrack(video);
  if (!track) return false;

  if (cueTextTrack === track) {
    onTextTrackCueChange();
    return true;
  }

  if (cueTextTrack) {
    cueTextTrack.removeEventListener("cuechange", onTextTrackCueChange);
  }
  setCueTextTrack(track);
  track.addEventListener("cuechange", onTextTrackCueChange);
  log("attached Dutch TextTrack", {
    language: track.language,
    label: track.label,
    mode: track.mode,
    kind: track.kind,
    cues: track.cues?.length ?? 0,
  });
  onTextTrackCueChange();
  prefetchUpcomingCues();
  return true;
};

const attachTranslationObserver = (targetNode: Element): void => {
  if (translationObserver && translationTargetNode === targetNode) return;

  if (translationObserver) {
    translationObserver.disconnect();
    setTranslationObserver(null);
  }

  setTranslationTargetNode(targetNode);
  const observer = new MutationObserver(handleMutations);
  setTranslationObserver(observer);
  const config = { attributes: false, childList: true, subtree: true, characterData: true } as MutationObserverInit;
  observer.observe(targetNode, config);
  log("observing subtitle overlay");
  void handleMutations();
};

const handleMutations = async (): Promise<void> => {
  const subtitleParentElement = document.querySelector(subtitleLabelSelector) as HTMLElement;
  if (!subtitleParentElement) return;

  const textToTranslate = getDutchSubtitleText(subtitleParentElement);
  if (!textToTranslate) return;

  if (cueTextTrack) {
    const trackText = getActiveCueText(cueTextTrack);
    if (trackText) {
      if (
        lastTranslatedText !== undefined &&
        trackText === lastText &&
        !subtitleParentElement.querySelector(".translated")
      ) {
        addTranslatedSubtitle(lastTranslatedText);
      }
      return;
    }
  }

  requestCueTranslation(textToTranslate, "dom");
};

const monitorDomChanges = (): void => {
  if (!translationWaitObserver) {
    const waitObserver = new MutationObserver(() => {
      if (!isTranslationActive) return;
      if (!cueTextTrack) attachTextTrackCueSource();
      const currentTarget = document.querySelector(subtitleOverlaySelector);
      if (currentTarget && currentTarget !== translationTargetNode) {
        log("subtitle overlay appeared or was replaced");
        attachTranslationObserver(currentTarget);
      }
    });
    setTranslationWaitObserver(waitObserver);
    waitObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const targetNode = document.querySelector(subtitleOverlaySelector);
  if (!targetNode) {
    log("subtitle overlay not in DOM yet, waiting");
    return;
  }

  attachTranslationObserver(targetNode);
};
