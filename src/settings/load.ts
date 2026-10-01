import {
  storageKeyAutoPauseEnabled,
  storageKeySelectedLanguage,
  storageKeyWordClickEnabled,
} from "./keys";
import { log } from "../shared/log";
import { safeStorageGet, safeStorageSet } from "../shared/storage";
import {
  currentSelectedLanguage,
  isAutoPauseEnabled,
  isWordClickEnabled,
  setAutoPauseEnabled,
  setCurrentSelectedLanguage,
  setWordClickEnabled,
} from "./state";
import { cueTextTrack } from "../cues/monitor-state";
import { isTranslationActive, lastText, setLastTranslatedText } from "../translation/state";
import { isPausedByWordHover, setPausedByWordHover } from "../words/state";
import {
  clearCueTranslationCache,
  prefetchUpcomingCues,
  requestCueTranslation,
} from "../translation/pipeline";
import { startWordClick, stopWordClick } from "../words/click";
import { playVideoOnce } from "../player/controls";

export const loadInitialSettings = (): void => {
  safeStorageGet(
    [storageKeyWordClickEnabled, storageKeyAutoPauseEnabled, storageKeySelectedLanguage],
    (data) => {
      if (data[storageKeySelectedLanguage]) {
        setCurrentSelectedLanguage(data[storageKeySelectedLanguage] as string);
      } else {
        safeStorageSet({ [storageKeySelectedLanguage]: "en" });
        setCurrentSelectedLanguage("en");
      }
      setAutoPauseEnabled(data[storageKeyAutoPauseEnabled] !== false);
      setWordClickEnabled(data[storageKeyWordClickEnabled] !== false);
      log("settings", { currentSelectedLanguage, isAutoPauseEnabled, isWordClickEnabled });
      if (isWordClickEnabled) {
        startWordClick();
      }
    }
  );
};

export const registerSettingsStorageListener = (): void => {
  chrome.storage.onChanged.addListener((changes) => {
    if (storageKeySelectedLanguage in changes && changes[storageKeySelectedLanguage].newValue) {
      setCurrentSelectedLanguage(changes[storageKeySelectedLanguage].newValue as string);
      clearCueTranslationCache();
      setLastTranslatedText(undefined);
      if (isTranslationActive) {
        if (lastText) requestCueTranslation(lastText, cueTextTrack ? "texttrack" : "dom");
        else prefetchUpcomingCues();
      }
    }
    if (storageKeyAutoPauseEnabled in changes) {
      setAutoPauseEnabled(changes[storageKeyAutoPauseEnabled].newValue !== false);
      if (changes[storageKeyAutoPauseEnabled].newValue === false) {
        if (isPausedByWordHover) {
          playVideoOnce();
        }
        setPausedByWordHover(false);
      }
    }
    if (storageKeyWordClickEnabled in changes) {
      setWordClickEnabled(changes[storageKeyWordClickEnabled].newValue === true);
      if (changes[storageKeyWordClickEnabled].newValue === true) {
        startWordClick();
      } else {
        stopWordClick();
      }
    }
  });
};
