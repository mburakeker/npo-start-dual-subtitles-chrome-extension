export function clickSettingsButton() {
  document
    .querySelectorAll(".bmpui-ui-settingstogglebutton > .bmpui-label")
    .forEach((el: Element) => {
      if (el.innerHTML.includes("Instellingen")) {
        (el as HTMLElement).click();
      }
    });
}

export function openSubtitleSettings() {
  document.querySelectorAll(".bmpui-ui-settings-panel-item").forEach((item) => {
    const label = item.querySelector("label.bmpui-ui-label");
    if (
      label &&
      label.textContent &&
      label.textContent.trim() === "Ondertiteling"
    ) {
      const button = item.querySelector("button");
      if (button) {
        button.click();
      }
    }
  });
}

export function hasNederlandsSubtitles(): boolean {
  let found = false;
  clickSettingsButton();
  // Read the DOM synchronously right after opening — the panel renders immediately
  openSubtitleSettings();
  const listbox = document.querySelector(".bmpui-ui-listbox");
  if (listbox) {
    found = Array.from(listbox.querySelectorAll("button")).some(
      (btn) => btn.textContent && btn.textContent.trim() === "Nederlands"
    );
  }
  // Close settings panel again regardless
  clickSettingsButton();
  return found;
}

export function turnOffSubtitles() {
  const listbox = document.querySelector(".bmpui-ui-listbox");

  if (listbox) {
    const uitButton = Array.from(listbox.querySelectorAll("button")).find(
      (btn) => btn.textContent && btn.textContent.trim() === "Uit"
    );
    if (uitButton) {
      uitButton.click();
    }
  }
}

export function turnOnSubtitles(): boolean {
  const listbox = document.querySelector(".bmpui-ui-listbox");

  if (listbox) {
    const nederlandsButton = Array.from(
      listbox.querySelectorAll("button")
    ).find((btn) => btn.textContent && btn.textContent.trim() === "Nederlands");
    if (nederlandsButton) {
      nederlandsButton.click();
      return true;
    }
  }
  return false;
}
