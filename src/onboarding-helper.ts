const settingsToggleSelector = ".npoplayer-settings-toggle-button";

function getMainSettingsPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.npoplayer-settings-panel[aria-label="Instellingen"]'
  );
}

function isSettingsPanelOpen(panel: Element | null): boolean {
  return Boolean(panel && !panel.classList.contains("npoplayer-hidden"));
}

export function clickSettingsButton() {
  const panel = getMainSettingsPanel();
  if (isSettingsPanelOpen(panel)) return;
  document.querySelector<HTMLElement>(settingsToggleSelector)?.click();
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
  if (!panel) return;

  const rows = panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row");
  for (const row of rows) {
    const label = row.querySelector(".npoplayer-settings-row-label");
    const labelText = label?.textContent?.trim();
    const ariaLabel = row.getAttribute("aria-label") ?? "";
    if (labelText === "Ondertiteling" || ariaLabel.startsWith("Ondertiteling")) {
      row.click();
      return;
    }
  }
}

function getSubtitleOptionsPanel(): Element | null {
  const panels = document.querySelectorAll(".npoplayer-settings-panel");
  for (const panel of panels) {
    const heading = panel.querySelector("h2");
    if (heading?.textContent?.trim() === "Ondertiteling") {
      return panel;
    }
  }
  return null;
}

function findSubtitleOptionButton(label: string): HTMLElement | null {
  const panel = getSubtitleOptionsPanel();
  if (!panel) return null;

  return (
    Array.from(panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row")).find(
      (btn) => {
        const text = btn.textContent?.replace("✔", "").trim();
        return text === label;
      }
    ) ?? null
  );
}

function isDutchSubtitleAlreadyOn(): boolean {
  const panel = getMainSettingsPanel();
  if (!panel) return false;

  for (const row of panel.querySelectorAll<HTMLElement>("button.npoplayer-settings-row")) {
    const label = row.querySelector(".npoplayer-settings-row-label")?.textContent?.trim();
    if (label !== "Ondertiteling") continue;
    const value = row.querySelector(".npoplayer-settings-row-value")?.textContent?.trim();
    return value === "Nederlands";
  }
  return false;
}

export function hasNederlandsSubtitles(): boolean {
  clickSettingsButton();
  openSubtitleSettings();
  const found = Boolean(findSubtitleOptionButton("Nederlands"));
  closeSettingsPanel();
  return found;
}

export function turnOffSubtitles() {
  findSubtitleOptionButton("Uit")?.click();
}

export function turnOnSubtitles(): boolean {
  if (isDutchSubtitleAlreadyOn()) {
    return true;
  }

  const nederlandsButton = findSubtitleOptionButton("Nederlands");
  if (nederlandsButton) {
    nederlandsButton.click();
    return true;
  }
  return false;
}
