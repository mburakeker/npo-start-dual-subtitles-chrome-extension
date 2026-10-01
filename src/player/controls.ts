import {
  controlbarRightSelector,
  playerRootSelector,
  toggleButtonId,
  subtitleOverlaySelector,
} from "./constants";
import { log } from "../shared/log";

export const dumpPlayerHints = (): void => {
  const classes = new Set<string>();
  document.querySelectorAll('[class*="npoplayer"], [class*="bmpui"]').forEach((el) => {
    el.classList.forEach((cls) => {
      if (cls.includes("npoplayer") || cls.includes("bmpui")) classes.add(cls);
    });
  });
  const video = document.querySelector<HTMLVideoElement>(`${playerRootSelector} video`);
  const tracks = video
    ? Array.from(video.textTracks).map((t) => ({
        kind: t.kind,
        language: t.language,
        label: t.label,
        mode: t.mode,
      }))
    : [];
  log("player hints", {
    href: location.href,
    isTopFrame: window === window.top,
    togglePresent: Boolean(document.getElementById(toggleButtonId)),
    controlbar: Boolean(document.querySelector(controlbarRightSelector)),
    overlay: Boolean(document.querySelector(subtitleOverlaySelector)),
    settingsToggle: Boolean(document.querySelector(".npoplayer-settings-toggle-button")),
    video: Boolean(video),
    textTracks: tracks,
    classes: [...classes].sort(),
  });
};

export const getPlayerVideo = (): HTMLVideoElement | null => {
  return document.querySelector<HTMLVideoElement>(`${playerRootSelector} video`);
};

export const getPlayToggleButton = (): HTMLElement | null => {
  return (
    document.querySelector<HTMLElement>(".npoplayer-small-play-button:not(.npoplayer-hidden)") ||
    document.querySelector<HTMLElement>(".npoplayer-play-button:not(.npoplayer-hidden)") ||
    document.querySelector<HTMLElement>(".npoplayer-small-play-button") ||
    document.querySelector<HTMLElement>(".npoplayer-play-button")
  );
};

export const pauseVideoOnce = (): boolean => {
  const video = getPlayerVideo();
  if (video && !video.paused) {
    video.pause();
    return true;
  }
  const btn = getPlayToggleButton();
  if (btn && !btn.classList.contains("paused")) {
    btn.click();
    return true;
  }
  return false;
};

export const playVideoOnce = (): boolean => {
  const video = getPlayerVideo();
  if (video && video.paused) {
    void video.play();
    return true;
  }
  const btn = getPlayToggleButton();
  if (btn && btn.classList.contains("paused")) {
    btn.click();
    return true;
  }
  return false;
};

export const isVideoPlaying = (): boolean => {
  const video = getPlayerVideo();
  if (video) return !video.paused;
  const btn = getPlayToggleButton();
  if (btn) return !btn.classList.contains("paused");
  return false;
};
