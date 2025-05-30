export type ChromeRuntimeMessage = {
  type: ChromeRuntimeMessageType;
  payload: string | null;
}

export enum ChromeRuntimeMessageType {
  InitiateMonitoring = "initiateMonitoring",
  Translate = "translate",
  TranslateFinished = "translateFinished",
  InitiateOneClickConfiguration = "initiateOneClickConfiguration",
}
