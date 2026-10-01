export type ChromeRuntimeMessage = {
  type: ChromeRuntimeMessageType;
  payload: string | null;
  /** Monotonic id so stale async translation replies can be ignored. */
  requestId?: number;
  /** Original Dutch cue text; echoed on TranslateFinished for cache keys. */
  sourceText?: string;
  /** Prefetch replies update the cache only (unless the cue is already active). */
  prefetch?: boolean;
};

export enum ChromeRuntimeMessageType {
  Translate = "translate",
  TranslateFinished = "translateFinished",
  TranslateWord = "translateWord",
  TranslateWordFinished = "translateWordFinished",
}
