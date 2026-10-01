export type ReleaseNote = {
  text: string;
  /** Release date as dd-mm-yyyy */
  date: string;
};

/** Shown in the popup and used for the toolbar "NEW" badge. Update with each release. */
export const releaseNotesByVersion: Record<string, ReleaseNote> = {
  "0.6.0": {
    date: "01-10-2026",
    text: "Faster subtitle translation by translating upcoming subtitles with TextTrack API instead of monitoring changes on the browser realtime.",
  },
  "0.5.2": {
    date: "01-10-2026",
    text: "Fixed issue where subtitles were appearing so tiny. Small refactoring around click-to-translate functionality. Added what's new section and a badge to make the updates more visible.",
  },
  "0.5.1": {
    date: "09-09-2026",
    text: "Fixed dual subtitles not appearing on the first click of the player toggle.",
  },
  "0.5.0": {
    date: "29-07-2026",
    text: "Updated the extension to comply with new changes on the player.",
  },
};

export const storageKeyLastSeenWhatsNew = "lastSeenWhatsNewVersion";

export const getReleaseNote = (version: string): ReleaseNote | null => {
  return releaseNotesByVersion[version] ?? null;
};

/** Whether the toolbar should show the NEW badge for this version. */
export const shouldShowWhatsNewBadge = (
  version: string,
  lastSeenVersion: string | undefined,
  hasReleaseNote: boolean
): boolean => {
  return hasReleaseNote && lastSeenVersion !== version;
};
