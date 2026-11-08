import { OfficeViewer } from "./OfficeViewer";
import type { OctopPluginUIHost } from "./types";

/**
 * Formats handled by the offline ONLYOFFICE engine. Legacy binaries (doc,
 * xls, ppt, …) open with ONLYOFFICE's default behaviour; agents only produce
 * OOXML, so they get no special handling.
 */
const OFFICE_EXTENSIONS = [
  // documents
  "docx", "docm", "dotx", "dotm", "doc", "odt", "rtf",
  // spreadsheets
  "xlsx", "xlsm", "xlsb", "xltx", "xltm", "xls", "ods", "csv", "tsv",
  // presentations
  "pptx", "pptm", "ppsx", "ppsm", "potx", "potm", "ppt", "odp",
  // pdf & fixed-layout
  "pdf", "xps", "oxps", "djvu", "ofd",
];

/**
 * Earlier builds let the editor register service workers under the plugin's
 * public path. We use none now; drop any left in this browser so a stale
 * worker can never serve an old editor build.
 */
function removeEditorServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      for (const reg of regs) {
        const script = reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? "";
        if (reg.scope.includes("/plugin-public/") || script.includes("/plugin-public/")) void reg.unregister();
      }
    })
    .catch(() => undefined);
}

export function setup(host: OctopPluginUIHost): void {
  removeEditorServiceWorkers();
  host.registerFileViewer({
    id: "office",
    extensions: OFFICE_EXTENSIONS,
    priority: 10,
    component: OfficeViewer,
  });
}

export default { setup };
