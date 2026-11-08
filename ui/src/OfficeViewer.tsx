import { React } from "./react";
import { AboutDialog, Dialog, Shell, ToolButton } from "./Shell";
import { BRAND_NAME } from "./brand";
import { translator } from "./i18n";
import { EDITOR_DIR } from "./editor-build";
import type { FileViewerProps } from "./types";

const { useCallback, useEffect, useMemo, useRef, useState } = React;

type Phase = "engine" | "file" | "ready" | "error";

interface EditorMessage {
  id?: string;
  type?: string;
  payload?: {
    dirty?: boolean;
    file?: Blob;
    message?: string;
    readonly?: boolean;
  };
}

/** ranuts reads the site theme from localStorage (same origin as Octop). */
function syncEditorTheme(theme: "light" | "dark"): void {
  try {
    window.localStorage.setItem("ran-theme", theme);
  } catch {
    /* private mode: editor falls back to system theme */
  }
}

const LOAD_TIMEOUT_MS = 20_000;

// Shown in the About dialog: when our modifications to the editor were made.
const EDITOR_MODIFIED = "2026-11";
// Public repository with the modified source (AGPL: users must be able to get it).
const SOURCE_URL = "https://github.com/zjf-plus/octop-office-editor";

// Window mode the user last chose; the next file opens the same way. Page
// memory only: after a reload the first file opens in the large window.
let lastExpanded = true;

// Phones always use the large window: a side panel is too cramped there.
function isPhoneViewport(): boolean {
  return window.matchMedia("(max-width: 768px), (pointer: coarse) and (max-width: 1024px)").matches;
}
const UTF8_BOM = [0xef, 0xbb, 0xbf];

function hasUtf8Bom(head: Uint8Array): boolean {
  return UTF8_BOM.every((b, i) => head[i] === b);
}

/**
 * The editor exports CSV/TSV with a UTF-8 BOM. Agents read these files as
 * plain text (a BOM turns the first header into "﻿姓名"), so keep the
 * original's choice.
 */
async function keepTextEncoding(saved: Blob, ext: string, originalHadBom: boolean): Promise<Blob> {
  if (originalHadBom || (ext !== "csv" && ext !== "tsv")) return saved;
  const head = new Uint8Array(await saved.slice(0, 3).arrayBuffer());
  return hasUtf8Bom(head) ? new Blob([saved.slice(3)], { type: saved.type }) : saved;
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Office / PDF viewer backed by the offline ONLYOFFICE build in
 * ``public/editor``. Octop owns the bytes: we read them through ``file.read``
 * and write the editor's export back to the same path via ``file.write``.
 */
export function OfficeViewer(props: FileViewerProps) {
  const { file, fileName, ext, publicBaseUrl, theme, locale, refreshToken } = props;
  // Stable per locale: effects (load timeout, message listener) depend on it,
  // and a fresh function each render would keep resetting the timeout.
  const t = useMemo(() => translator(locale), [locale]);
  const canWrite = file.write !== null;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  // No view/edit switch: writable files open editable, others read-only.
  const readonly = !canWrite;
  const dirtyRef = useRef(false);
  const originalHadBomRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("engine");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  // Large window first; after that, whatever mode the user last picked.
  const [expanded, setExpanded] = useState(lastExpanded);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  // Pending answer to "may we leave this file?" (close, or the host opening
  // another file); settled by the unsaved-changes dialog or the save result.
  const leaveRef = useRef<((ok: boolean) => void) | null>(null);
  const finishLeave = useCallback((ok: boolean) => {
    const resolve = leaveRef.current;
    leaveRef.current = null;
    resolve?.(ok);
  }, []);
  const confirmLeave = useCallback((): Promise<boolean> => {
    if (!dirtyRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      leaveRef.current?.(false);
      leaveRef.current = resolve;
      setConfirmClose(true);
    });
  }, []);
  const { setLeaveGuard } = props;
  useEffect(() => {
    setLeaveGuard?.(confirmLeave);
    return () => {
      setLeaveGuard?.(null);
      finishLeave(true);
    };
  }, [setLeaveGuard, confirmLeave, finishLeave]);

  // Theme must be in place before the editor boots.
  const [src] = useState(() => {
    syncEditorTheme(theme);
    const url = new URL(`${EDITOR_DIR}/editor.html`, publicBaseUrl);
    url.searchParams.set("embed", "1");
    url.searchParams.set("embedOrigin", window.location.origin);
    return url.toString();
  });

  const post = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, payload }, window.location.origin);
  }, []);

  const openCurrent = useCallback(async () => {
    setPhase("file");
    setError(null);
    try {
      const blob = await file.read();
      const buffer = await blob.arrayBuffer();
      originalHadBomRef.current = hasUtf8Bom(new Uint8Array(buffer, 0, Math.min(3, buffer.byteLength)));
      post("document:open-buffer", { fileName, buffer, readonly });
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [file, fileName, post, readonly]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent<EditorMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const { type, payload } = event.data || {};
      if (!type?.startsWith("document:")) return;
      switch (type) {
        // ``ready`` rides the iframe load event and can fire before the
        // editor registers it, so a ``get-state`` answer counts as ready too.
        case "document:ready":
        case "document:state":
          if (readyRef.current) break;
          readyRef.current = true;
          void openCurrent();
          break;
        case "document:opened":
          setPhase("ready");
          dirtyRef.current = false;
          setDirty(false);
          break;
        case "document:dirty-changed":
          dirtyRef.current = !!payload?.dirty;
          setDirty(!!payload?.dirty);
          break;
        case "document:saved": {
          if (!payload?.file || !file.write) {
            setSaving(false);
            break;
          }
          try {
            await file.write(await keepTextEncoding(payload.file, ext, originalHadBomRef.current));
            setSavedAt(new Date());
            setError(null);
            // Edits made during export are not in these bytes.
            dirtyRef.current = !!payload.dirty;
            setDirty(!!payload.dirty);
            if (leaveRef.current) finishLeave(!payload.dirty);
          } catch (err) {
            finishLeave(false);
            dirtyRef.current = true;
            setDirty(true);
            setError(t("saveFailed", { msg: err instanceof Error ? err.message : String(err) }));
          } finally {
            setSaving(false);
          }
          break;
        }
        case "document:error":
          finishLeave(false);
          setSaving(false);
          setError(payload?.message ?? "unknown error");
          if (!readyRef.current) setPhase("error");
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [file, openCurrent, t, finishLeave]);

  // Every (re)load of the editor page needs a fresh handshake: if the frame
  // reloads itself after it was ready, the document must be opened again or
  // the viewer sits on "loading" forever. Probe until the embed API answers.
  const probeTimer = useRef<number | undefined>(undefined);
  const onFrameLoad = useCallback(() => {
    if (iframeRef.current?.src === "about:blank") return;
    readyRef.current = false;
    window.clearInterval(probeTimer.current);
    probeTimer.current = window.setInterval(() => {
      if (readyRef.current) {
        window.clearInterval(probeTimer.current);
        return;
      }
      post("document:get-state");
    }, 300);
  }, [post]);
  useEffect(() => () => window.clearInterval(probeTimer.current), []);

  // Never spin forever: surface a timeout with a retry instead.
  useEffect(() => {
    if (phase !== "engine" && phase !== "file") return;
    const timer = window.setTimeout(() => {
      setPhase("error");
      setError(t(phase === "engine" ? "timeoutEngine" : "timeoutFile"));
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, frameKey, t]);

  const retry = () => {
    readyRef.current = false;
    dirtyRef.current = false;
    setDirty(false);
    setError(null);
    setPhase("engine");
    setFrameKey((k) => k + 1);
  };

  // Agent rewrote the file: reload unless the user has unsaved edits.
  const firstRefresh = useRef(true);
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    if (readyRef.current && !dirtyRef.current) void openCurrent();
  }, [refreshToken, openCurrent]);

  // Unload the editor (and its wasm heap) as soon as the viewer goes away,
  // instead of waiting for the detached frame to be collected.
  useEffect(() => {
    const ref = iframeRef;
    return () => {
      const frame = ref.current;
      if (frame) frame.src = "about:blank";
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const save = () => {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    post("document:save", {});
  };

  const download = async () => {
    const blob = await file.read();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // No fullscreen at all: leaving the browser's native fullscreen froze the
  // page (OS transition + resize storm in the same-origin editor frame), and
  // the large window already fills the page.
  const toggleExpanded = () => {
    lastExpanded = !expanded;
    setExpanded(lastExpanded);
  };

  const close = () => {
    void confirmLeave().then((ok) => {
      if (ok) props.onClose?.();
    });
  };

  // A save already running settles the pending leave when it lands.
  const saveAndLeave = () => {
    setConfirmClose(false);
    save();
  };

  const phone = isPhoneViewport();
  const showExpanded = phone || expanded;

  let status: string;
  let tone: "normal" | "warn" | "error" = "normal";
  if (error) {
    status = t("failed", { msg: error });
    tone = "error";
  } else if (phase === "engine") status = t("loadingEngine");
  else if (phase === "file") status = t("loadingFile");
  else if (saving) status = t("saving");
  else if (dirty) {
    status = t("dirty");
    tone = "warn";
  } else if (savedAt) status = t("savedAt", { time: timeLabel(savedAt) });
  else if (!canWrite) status = t("readonly");
  else status = t("opened");

  const actions = (
    <>
      {canWrite && (
        <ToolButton
          icon="save"
          label={saving ? t("saving") : t("save")}
          primary
          disabled={saving || !dirty || phase !== "ready"}
          onClick={save}
        />
      )}
      <ToolButton icon="download" label={t("download")} onClick={() => void download()} />
      <span className="wmfv-sep" />
      {!phone && (
        <ToolButton
          icon={expanded ? "minimize" : "expand"}
          label={expanded ? t("minimize") : t("expand")}
          onClick={toggleExpanded}
        />
      )}
      {props.onClose && <ToolButton icon="close" label={t("close")} onClick={close} />}
    </>
  );

  return (
    <Shell
      fileName={fileName}
      ext={ext}
      status={status}
      statusTone={tone}
      actions={actions}
      expanded={showExpanded}
      onBackdropClick={phone ? undefined : toggleExpanded}
      brandLabel={t("aboutOpen", { brand: BRAND_NAME })}
      onBrandClick={() => setShowAbout(true)}
      dialog={
        confirmClose ? (
          <Dialog
            title={t("closeTitle")}
            message={t("closeMessage", { name: fileName })}
            actions={[
              { label: t("cancel"), onClick: () => { setConfirmClose(false); finishLeave(false); } },
              {
                label: t("discard"),
                danger: true,
                onClick: () => {
                  setConfirmClose(false);
                  dirtyRef.current = false;
                  finishLeave(true);
                },
              },
              { label: t("saveAndClose"), primary: true, onClick: saveAndLeave },
            ]}
          />
        ) : showAbout ? (
          <AboutDialog
            title={t("aboutTitle", { brand: BRAND_NAME })}
            paragraphs={[t("aboutBasedOn", { date: EDITOR_MODIFIED }), t("aboutLicense")]}
            links={[
              { label: t("aboutLicenseLink"), href: new URL(`${EDITOR_DIR}/LICENSE.txt`, publicBaseUrl).toString() },
              { label: t("aboutNoticeLink"), href: new URL(`${EDITOR_DIR}/NOTICE.txt`, publicBaseUrl).toString() },
              { label: t("aboutSourceLink"), href: SOURCE_URL },
            ]}
            okLabel={t("aboutOk")}
            onClose={() => setShowAbout(false)}
          />
        ) : null
      }
    >
      <iframe
        key={frameKey}
        ref={iframeRef}
        src={src}
        title={fileName}
        onLoad={onFrameLoad}
        allow="clipboard-read; clipboard-write"
      />
      {phase !== "ready" && (
        <div className="wmfv-overlay">
          <div>{status}</div>
          {phase === "error" && (
            <button type="button" className="wmfv-btn" data-primary="" onClick={retry}>
              {t("retry")}
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}
