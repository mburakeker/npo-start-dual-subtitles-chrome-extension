export type ChromeRuntimeMessage = {
  type: ChromeRuntimeMessageType;
  payload: string | null;
}

export enum ChromeRuntimeMessageType {
  Translate = "translate",
  TranslateFinished = "translateFinished",
}
