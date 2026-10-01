import { translatedSubtitleColor } from "../player/constants";
import { logWarn } from "../shared/log";
import { currentSelectedLanguage } from "../settings/state";
import { getSubtitleOverlayElement } from "./text";

export const addTranslatedSubtitle = (subtitle: string): void => {
  const subtitleParentElement = getSubtitleOverlayElement();
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
  newSpan.classList.add("translated", "npoplayer-subtitle-line");
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
