export type ReleaseNote = {
  text: string;
  /** Release date as dd-mm-yyyy */
  date: string;
};

/** Shown in the popup and used for the toolbar "NEW" badge. Update with each release. */
export const releaseNotesByVersion: Record<string, ReleaseNote> = {
  "0.5.2": {
    date: "01-10-2026",
    text: "Fixed click-to-translate only showing the result on the second click; pausing the video no longer clears the in-flight word lookup.",
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
