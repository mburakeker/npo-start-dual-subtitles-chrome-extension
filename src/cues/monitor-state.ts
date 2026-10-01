/** Primary cue source when NPO exposes a Dutch TextTrack; DOM observer is the fallback. */
export let cueTextTrack: TextTrack | null = null;
export let cueTextTrackVideo: HTMLVideoElement | null = null;
export let textTracksList: TextTrackList | null = null;
export let translationObserver: MutationObserver | null = null;
export let translationWaitObserver: MutationObserver | null = null;
export let translationTargetNode: Element | null = null;

export const setCueTextTrack = (track: TextTrack | null): void => {
  cueTextTrack = track;
};

export const setCueTextTrackVideo = (video: HTMLVideoElement | null): void => {
  cueTextTrackVideo = video;
};

export const setTextTracksList = (list: TextTrackList | null): void => {
  textTracksList = list;
};

export const setTranslationObserver = (observer: MutationObserver | null): void => {
  translationObserver = observer;
};

export const setTranslationWaitObserver = (observer: MutationObserver | null): void => {
  translationWaitObserver = observer;
};

export const setTranslationTargetNode = (node: Element | null): void => {
  translationTargetNode = node;
};
