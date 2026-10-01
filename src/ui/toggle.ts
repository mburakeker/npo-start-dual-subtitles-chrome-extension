import {
  controlbarRightSelector,
  toggleButtonId,
  noSubtitlesNoticeId,
  playerRootSelector,
} from "../player/constants";
import { log, logWarn } from "../shared/log";
import { dumpPlayerHints } from "../player/controls";
import { onLocationMaybeChanged } from "./navigation";
import {
  isActivationInProgress,
  playerContainerObserver,
  setActivationInProgress,
  setPlayerContainerObserver,
  noSubtitlesNoticeTimer,
  setNoSubtitlesNoticeTimer,
} from "./state";
import { isTranslationActive } from "../translation/state";
import { activateWithSubtitles, finishActivation } from "../player/activation";
import { stopMonitoring } from "../cues/monitor";

export const updateToggleButtonState = (): void => {
  const btn = document.getElementById(toggleButtonId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.setAttribute("aria-busy", "false");
  if (isTranslationActive) {
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Dual subtitles: on");
    btn.setAttribute("title", "Toggle dual subtitles");
    btn.style.filter = "none";
    btn.style.opacity = "1";
  } else {
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Dual subtitles: off");
    btn.setAttribute("title", "Toggle dual subtitles");
    btn.style.filter = "grayscale(1)";
    btn.style.opacity = "0.45";
  }
};

export const updateToggleButtonPending = (pending: boolean): void => {
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

export const hideNoSubtitlesNotice = (): void => {
  if (noSubtitlesNoticeTimer !== null) {
    window.clearTimeout(noSubtitlesNoticeTimer);
    setNoSubtitlesNoticeTimer(null);
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

export const showNoSubtitlesNotice = (): void => {
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

  setNoSubtitlesNoticeTimer(
    window.setTimeout(() => {
      hideNoSubtitlesNotice();
      updateToggleButtonState();
    }, 6000)
  );
};

const injectToggleButton = (controlbarRight: Element): void => {
  if (document.getElementById(toggleButtonId)) return;

  const btn = document.createElement("button");
  btn.id = toggleButtonId;
  btn.type = "button";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Dual subtitles: off");
  btn.setAttribute("title", "Toggle dual subtitles");

  const svgDataUri =
    "data:image/svg+xml;charset=utf-8,%3Csvg fill='none' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 260'%3E%3Cpath d='M120 70H245V185H215L235 245L155 185H120V70Z' fill='white' stroke='black' stroke-width='4' stroke-linejoin='round'/%3E%3Ctext x='145' y='150' font-family='Arial%2C sans-serif' font-size='60' font-weight='bold' fill='black'%3EEN%3C/text%3E%3Cpath d='M15 15H150V135H60L25 215V135H15V15Z' fill='%23FF7F00' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3Ctext x='22' y='95' font-family='Arial%2C sans-serif' font-size='55' font-weight='bold' fill='white'%3ENPO%3C/text%3E%3C/svg%3E";

  btn.style.background = "transparent";
  btn.style.backgroundImage = `url("${svgDataUri}")`;
  btn.style.backgroundRepeat = "no-repeat";
  btn.style.backgroundPosition = "center";
  btn.style.backgroundSize = "24px";
  btn.style.border = "none";
  btn.style.width = "24px";
  btn.style.height = "24px";
  btn.style.padding = "0";
  btn.style.margin = "0";
  btn.style.cursor = "pointer";
  btn.style.filter = "grayscale(1)";
  btn.style.opacity = "0.45";
  btn.style.transition = "filter 0.2s, opacity 0.2s";
  btn.style.flexShrink = "0";
  btn.style.alignSelf = "center";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isActivationInProgress) {
      log("ignoring click, activation already in progress");
      return;
    }
    if (isTranslationActive) {
      stopMonitoring();
      return;
    }
    setActivationInProgress(true);
    void activateWithSubtitles(false).finally(() => {
      finishActivation();
    });
  });

  controlbarRight.prepend(btn);
  updateToggleButtonState();
  log("injected toggle button");
};

export const watchForPlayerContainer = (): void => {
  const tryInject = (): void => {
    onLocationMaybeChanged();
    const controlbar = document.querySelector(controlbarRightSelector);
    if (controlbar && !document.getElementById(toggleButtonId)) {
      injectToggleButton(controlbar);
    }
  };

  tryInject();

  if (!playerContainerObserver) {
    const observer = new MutationObserver(tryInject);
    setPlayerContainerObserver(observer);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.setTimeout(() => {
    if (!document.getElementById(toggleButtonId)) {
      logWarn("toggle button not injected after 5s");
      dumpPlayerHints();
    }
  }, 5000);
};
