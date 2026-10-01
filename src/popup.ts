'use strict';

import {
  getReleaseNote,
  storageKeyLastSeenWhatsNew,
} from "./whats-new/notes";

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

const githubNewIssueUrl = 'https://github.com/mburakeker/npo-start-dual-subtitles-chrome-extension/issues/new';
const githubIssueLink = document.getElementById('github-issue-link') as HTMLAnchorElement;

const buildGitHubIssueUrl = (): string => {
  const version = chrome.runtime.getManifest().version;
  const body = [
    '## What happened',
    '',
    '<!-- Describe what went wrong -->',
    '',
    '## Steps to reproduce',
    '',
    '1. Open a video on https://npo.nl/start',
    '2. Click the NPO/EN toggle in the player',
    '3. ',
    '',
    '## Expected behavior',
    '',
    '',
    '## Extra info',
    '',
    `- Extension version: ${version}`,
    `- Target language: ${languageSelector.value}`,
    `- Browser: ${navigator.userAgent}`,
    '',
  ].join('\n');

  return (
    githubNewIssueUrl +
    '?title=' + encodeURIComponent('[Bug] Dual subtitles not working') +
    '&body=' + encodeURIComponent(body)
  );
};

const refreshGitHubIssueLink = (): void => {
  githubIssueLink.href = buildGitHubIssueUrl();
};

refreshGitHubIssueLink();

languageSelector.addEventListener('change', (event) => {
  const selectedLanguage = (event.target as HTMLSelectElement).value;
  chrome.storage.local.set({ selectedLanguage });
  refreshGitHubIssueLink();
});

chrome.storage.local.get('selectedLanguage', (data) => {
  if (data.selectedLanguage) {
    languageSelector.value = data.selectedLanguage;
  } else {
    chrome.storage.local.set({ selectedLanguage: 'en' });
  }
  refreshGitHubIssueLink();
});

// word-click toggle
const wordClickToggle = document.getElementById('word-click-toggle') as HTMLInputElement;
const autoPauseToggle = document.getElementById('auto-pause-toggle') as HTMLInputElement;

chrome.storage.local.get(['wordClickEnabled', 'autoPauseEnabled'], (data) => {
  wordClickToggle.checked = data.wordClickEnabled !== false;
  autoPauseToggle.checked = data.autoPauseEnabled !== false;
});

wordClickToggle.addEventListener('change', () => {
  chrome.storage.local.set({ wordClickEnabled: wordClickToggle.checked });
});

autoPauseToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoPauseEnabled: autoPauseToggle.checked });
});

const setupWhatsNew = (): void => {
  const version = chrome.runtime.getManifest().version;
  const note = getReleaseNote(version);
  const card = document.getElementById('whats-new');
  const versionEl = document.getElementById('whats-new-version');
  const textEl = document.getElementById('whats-new-text');
  if (!card || !versionEl || !textEl || !note) return;

  versionEl.textContent = `v${version} / ${note.date}`;
  textEl.textContent = note.text;
  card.hidden = false;

  chrome.storage.local.get(storageKeyLastSeenWhatsNew, (data) => {
    const lastSeen = data[storageKeyLastSeenWhatsNew] as string | undefined;
    const isUnread = lastSeen !== version;
    card.classList.toggle('is-new', isUnread);

    // Opening the popup marks the note as seen and clears the toolbar badge.
    if (isUnread) {
      chrome.storage.local.set({ [storageKeyLastSeenWhatsNew]: version });
      void chrome.action.setBadgeText({ text: '' });
    }
  });
};

setupWhatsNew();
