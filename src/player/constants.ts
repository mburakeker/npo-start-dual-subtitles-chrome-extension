/** NPO player DOM selectors and extension UI ids. */
export const subtitleOverlaySelector = ".npoplayer-subtitle-overlay";
export const subtitleLabelSelector = ".npoplayer-subtitle-overlay";
export const playerRootSelector = ".npoplayer-video";
export const controlbarRightSelector = ".npoplayer-bottom-bar-container-right";
export const toggleButtonId = "npo-dual-sub-toggle";
export const noSubtitlesNoticeId = "npo-dual-sub-notice";
export const translatedSubtitleColor = "#1eb7d3";
export const subtitlePointerStyleId = "npo-subtitle-pointer-styles";

/** How many future TextTrack cues to translate ahead of the playhead. */
export const PREFETCH_AHEAD = 5;
export const CUE_TRANSLATION_CACHE_MAX = 200;
export const PREFETCH_SCAN_MIN_INTERVAL_MS = 1500;
