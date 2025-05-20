'use strict';

import { ChromeRuntimeMessage, ChromeRuntimeMessageType } from "./types";

// add languages to the language selector
const languageSelector = document.getElementById('language-selector') as HTMLSelectElement;

const languages = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'cs', name: 'Czech' },
  { code: 'sk', name: 'Slovak' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'el', name: 'Greek' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'ka', name: 'Georgian' },
];

languages.forEach((language) => {
  const option = document.createElement('option');
  option.value = language.code;
  option.textContent = language.name;
  languageSelector.appendChild(option);
});
// set the default language to English
languageSelector.value = 'en';
// add event listener to save the selected language
languageSelector.addEventListener('change', (event) => {
  const selectedLanguage = (event.target as HTMLSelectElement).value;
  chrome.storage.local.set({ selectedLanguage });
});

// get the saved language from storage and set it as the selected value
chrome.storage.local.get('selectedLanguage', (data) => {
  if (data.selectedLanguage) {
    languageSelector.value = data.selectedLanguage;
  }
});

// add event listener to the activate button
const activateButton = document.getElementById('activate-button') as HTMLButtonElement;
activateButton.addEventListener('click', () => {
  // send a message to the content script to start monitoring
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
            type: ChromeRuntimeMessageType.InitiateMonitoring,
          } as ChromeRuntimeMessage);
    }
  });
});