export let currentSelectedLanguage = "en";
export let isAutoPauseEnabled = true;
export let isWordClickEnabled = true;

export const setCurrentSelectedLanguage = (lang: string): void => {
  currentSelectedLanguage = lang;
};

export const setAutoPauseEnabled = (value: boolean): void => {
  isAutoPauseEnabled = value;
};

export const setWordClickEnabled = (value: boolean): void => {
  isWordClickEnabled = value;
};
