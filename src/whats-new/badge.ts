import {
  getReleaseNote,
  shouldShowWhatsNewBadge,
  storageKeyLastSeenWhatsNew,
} from "./notes";

export const syncWhatsNewBadge = (): void => {
  const version = chrome.runtime.getManifest().version;
  const note = getReleaseNote(version);
  chrome.storage.local.get(storageKeyLastSeenWhatsNew, (data) => {
    const lastSeen = data[storageKeyLastSeenWhatsNew] as string | undefined;
    const showBadge = shouldShowWhatsNewBadge(version, lastSeen, Boolean(note));
    void chrome.action.setBadgeText({ text: showBadge ? "NEW" : "" });
    if (showBadge) {
      void chrome.action.setBadgeBackgroundColor({ color: "#f56a00" });
      if (chrome.action.setBadgeTextColor) {
        void chrome.action.setBadgeTextColor({ color: "#ffffff" });
      }
    }
    void chrome.action.setIcon({
      path: {
        128: "images/icon-128.png",
        256: "images/icon-256.png",
      },
    });
  });
};

export const registerWhatsNewListeners = (): void => {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      chrome.storage.local.set({
        [storageKeyLastSeenWhatsNew]: chrome.runtime.getManifest().version,
      });
      void chrome.action.setBadgeText({ text: "" });
      return;
    }
    syncWhatsNewBadge();
  });

  chrome.runtime.onStartup.addListener(() => {
    syncWhatsNewBadge();
  });

  syncWhatsNewBadge();
};
