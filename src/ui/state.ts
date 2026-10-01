export let isActivationInProgress = false;
export let revalidateQueued = false;
export let lastLocationKey = location.pathname + location.search;
export let playerContainerObserver: MutationObserver | null = null;
export let noSubtitlesNoticeTimer: number | null = null;

export const setActivationInProgress = (value: boolean): void => {
  isActivationInProgress = value;
};

export const setRevalidateQueued = (value: boolean): void => {
  revalidateQueued = value;
};

export const setLastLocationKey = (key: string): void => {
  lastLocationKey = key;
};

export const setNoSubtitlesNoticeTimer = (timer: number | null): void => {
  noSubtitlesNoticeTimer = timer;
};

export const setPlayerContainerObserver = (observer: MutationObserver | null): void => {
  playerContainerObserver = observer;
};
