'use strict';

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

// word-click toggle
const wordClickToggle = document.getElementById('word-click-toggle') as HTMLInputElement;
const subtitleSelectionToggle = document.getElementById('subtitle-selection-toggle') as HTMLInputElement;
const autoPauseToggle = document.getElementById('auto-pause-toggle') as HTMLInputElement;

chrome.storage.local.get(['wordClickEnabled', 'subtitleSelectionEnabled', 'autoPauseEnabled'], (data) => {
  const wordClickEnabled = data.wordClickEnabled !== false;
  const subtitleSelectionEnabled = data.subtitleSelectionEnabled === true;
  const autoPauseEnabled = data.autoPauseEnabled !== false;
  autoPauseToggle.checked = autoPauseEnabled;

  // Modes are mutually exclusive; keep selectable mode when both were saved as true.
  if (wordClickEnabled && subtitleSelectionEnabled) {
    wordClickToggle.checked = false;
    subtitleSelectionToggle.checked = true;
    chrome.storage.local.set({ wordClickEnabled: false, subtitleSelectionEnabled: true });
    return;
  }

  wordClickToggle.checked = wordClickEnabled;
  subtitleSelectionToggle.checked = subtitleSelectionEnabled;
});

wordClickToggle.addEventListener('change', () => {
  if (wordClickToggle.checked) {
    subtitleSelectionToggle.checked = false;
    chrome.storage.local.set({ wordClickEnabled: true, subtitleSelectionEnabled: false });
  } else {
    chrome.storage.local.set({ wordClickEnabled: false });
  }
});

// selectable subtitle mode toggle (for external translators)
subtitleSelectionToggle.addEventListener('change', () => {
  if (subtitleSelectionToggle.checked) {
    wordClickToggle.checked = false;
    chrome.storage.local.set({ subtitleSelectionEnabled: true, wordClickEnabled: false });
  } else {
    chrome.storage.local.set({ subtitleSelectionEnabled: false });
  }
});

autoPauseToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoPauseEnabled: autoPauseToggle.checked });
});