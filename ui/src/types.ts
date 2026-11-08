// Mirror of Octop's dashboard/src/plugins/fileViewers/types.ts (the plugin
// contract). Keep in sync when the host contract changes.
import type { ComponentType } from "react";

export interface FileViewerFileApi {
  read(signal?: AbortSignal): Promise<Blob>;
  write: ((data: Blob) => Promise<void>) | null;
}

export interface FileViewerProps {
  pluginId: string;
  path: string;
  fileName: string;
  ext: string;
  file: FileViewerFileApi;
  publicBaseUrl: string;
  theme: "light" | "dark";
  locale: string;
  refreshToken: number;
  onClose?: () => void;
  /** Host asks before leaving this file; resolve false to stay. */
  setLeaveGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

export interface OctopPluginUIHost {
  registerFileViewer(reg: {
    id: string;
    extensions: string[];
    priority?: number;
    component: ComponentType<FileViewerProps>;
  }): void;
}
