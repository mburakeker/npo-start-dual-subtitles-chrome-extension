import { log } from "../shared/log";
import { lastLocationKey, setLastLocationKey } from "./state";
import { handleVideoNavigation } from "../player/activation";

export const onLocationMaybeChanged = (): void => {
  const next = location.pathname + location.search;
  if (next === lastLocationKey) return;
  setLastLocationKey(next);
  log("location changed", next);
  void handleVideoNavigation();
};

export const watchLocationChanges = (): void => {
  const wrapHistoryMethod = (method: "pushState" | "replaceState"): void => {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History["pushState"]>) => {
      const result = original(...args);
      onLocationMaybeChanged();
      return result;
    };
  };
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("popstate", onLocationMaybeChanged);
};
