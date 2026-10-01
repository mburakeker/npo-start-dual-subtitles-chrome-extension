import { log } from "./shared/log";
import { registerContentTranslationHandlers } from "./translation/content-handlers";
import { loadInitialSettings, registerSettingsStorageListener } from "./settings/load";
import { watchForPlayerContainer } from "./ui/toggle";
import { watchLocationChanges } from "./ui/navigation";

log("content script loaded", { href: location.href, isTopFrame: window === window.top });
registerContentTranslationHandlers();
loadInitialSettings();
registerSettingsStorageListener();
watchForPlayerContainer();
watchLocationChanges();
