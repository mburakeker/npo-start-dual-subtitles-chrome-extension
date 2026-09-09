const settingsToggleSelector = ".npoplayer-settings-toggle-button";
const LOG_PREFIX = "[npo-dual-sub]";

const SETTINGS_PANEL_LABELS = ["Instellingen", "Settings"];
const SUBTITLE_LABELS = ["Ondertiteling", "Subtitles"];
const DUTCH_LABELS = ["Nederlands", "Dutch"];
const OFF_LABELS = ["Uit", "Off"];

const log = (...args: unknown[]): void => {
  console.info(LOG_PREFIX, ...args);
};

const textMatches = (value: string | null | undefined, labels: string[]): boolean => {
  const text = value?.trim();
  return Boolean(text && labels.includes(text));
};

function getMainSettingsPanel(): HTMLElement | null {
  for (const label of SETTINGS_PANEL_LABELS) {
    const labeled = document.querySelector<HTMLElement>(
      `.npoplayer-settings-panel[aria-label="${label}"]`
    );
    if (labeled) return labeled;
  }

  const panels = document.querySelectorAll<HTMLElement>(".npoplayer-settings-panel");
  for (const panel of panels) {
    const rows = panel.querySelectorAll(".npoplayer-settings-row-label");
    for (const row of rows) {
      if (textMatches(row.textContent, SUBTITLE_LABELS)) return panel;
    }
  }
  return null;
}

function isSettingsPanelOpen(panel: Element | null): boolean {
  return Boolean(panel && !panel.classList.contains("npoplayer-hidden"));
}

export function clickSettingsButton() {
  const panel = getMainSettingsPanel();
  if (isSettingsPanelOpen(panel)) {
    log("settings panel already open");
    return;
  }
  const toggle = document.querySelector<HTMLElement>(settingsToggleSelector);
  if (!toggle) {
    log("settings toggle button not found");
    return;
  }
  log("clicking settings toggle");
  toggle.click();
}

export function closeSettingsPanel() {
  const openPanel = document.querySelector(
    ".npoplayer-settings-panel:not(.npoplayer-hidden)"
  );
  if (!openPanel) return;

  const mainPanel = getMainSettingsPanel();
  if (isSettingsPanelOpen(mainPanel)) {
    mainPanel
      ?.querySelector<HTMLElement>(".npoplayer-settings-panel-close-button")
      ?.click();
    return;
  }

  // Submenu is open (e.g. Ondertiteling) — toggle dismisses the whole stack.
  document.querySelector<HTMLElement>(settingsToggleSelector)?.click();
}

export function openSubtitleSettings() {
  const panel = getMainSettingsPanel();
  if (!panel) {
    log("cannot open subtitle settings: main panel missing");
    return;
  }

  const rows = panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row");
  log("settings rows", Array.from(rows).map((row) => ({
    label: row.querySelector(".npoplayer-settings-row-label")?.textContent?.trim(),
    value: row.querySelector(".npoplayer-settings-row-value")?.textContent?.trim(),
    aria: row.getAttribute("aria-label"),
  })));

  for (const row of rows) {
    const label = row.querySelector(".npoplayer-settings-row-label");
    const labelText = label?.textContent?.trim();
    const ariaLabel = row.getAttribute("aria-label") ?? "";
    if (
      textMatches(labelText, SUBTITLE_LABELS) ||
      SUBTITLE_LABELS.some((name) => ariaLabel.startsWith(name))
    ) {
      log("opening subtitle settings row", labelText || ariaLabel);
      row.click();
      return;
    }
  }
  log("subtitle settings row not found");
}

function getSubtitleOptionsPanel(): Element | null {
  const panels = document.querySelectorAll(".npoplayer-settings-panel");
  for (const panel of panels) {
    const heading = panel.querySelector("h2");
    if (textMatches(heading?.textContent, SUBTITLE_LABELS)) {
      return panel;
    }
  }
  return null;
}

function findSubtitleOptionButton(labels: string[]): HTMLElement | null {
  const panel = getSubtitleOptionsPanel();
  if (!panel) return null;

  return (
    Array.from(panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row")).find(
      (btn) => {
        const text = btn.textContent?.replace("✔", "").trim();
        return textMatches(text, labels);
      }
    ) ?? null
  );
}

export function isDutchSubtitleAlreadyOn(): boolean {
  const panel = getMainSettingsPanel();
  if (!panel) return false;

  for (const row of panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row")) {
    const label = row.querySelector(".npoplayer-settings-row-label")?.textContent?.trim();
    if (!textMatches(label, SUBTITLE_LABELS)) continue;
    const value = row.querySelector(".npoplayer-settings-row-value")?.textContent?.trim();
    return textMatches(value, DUTCH_LABELS);
  }
  return false;
}

export function hasNederlandsSubtitles(): boolean {
  clickSettingsButton();
  openSubtitleSettings();
  const found = Boolean(findSubtitleOptionButton(DUTCH_LABELS));
  closeSettingsPanel();
  return found;
}

export function turnOffSubtitles() {
  findSubtitleOptionButton(OFF_LABELS)?.click();
}

export function turnOnSubtitles(): boolean {
  if (isDutchSubtitleAlreadyOn()) {
    log("Dutch subtitles already on");
    return true;
  }

  const nederlandsButton = findSubtitleOptionButton(DUTCH_LABELS);
  if (nederlandsButton) {
    log("clicking Dutch subtitle option");
    nederlandsButton.click();
    return true;
  }
  log("Dutch subtitle option not found");
  return false;
}
