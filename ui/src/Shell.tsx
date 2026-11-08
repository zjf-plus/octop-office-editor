import { React } from "./react";
import type { ReactNode } from "react";
import { BRAND_LOGO, BRAND_NAME } from "./brand";

// ONLYOFFICE's AGPL terms require prominent notices naming the original
// developer, the modification and the license: the brand opens AboutDialog.

/**
 * Shared frame for every viewer: same top bar (name, format tag, status,
 * actions) and body, so all formats look and behave alike.
 */
export interface ShellProps {
  fileName: string;
  ext: string;
  status: ReactNode;
  statusTone?: "normal" | "warn" | "error";
  actions: ReactNode;
  children: ReactNode;
  /** Large window over the page instead of the side panel. */
  expanded?: boolean;
  onBackdropClick?: () => void;
  /** Modal layer over the whole window (e.g. a confirm dialog). */
  dialog?: ReactNode;
  /** Opens the About dialog (license and attribution notices). */
  onBrandClick: () => void;
  brandLabel: string;
}

const css = `
.wmfv-root{--wm-text:var(--fn-text-primary,#1f2329);--wm-text-2:var(--fn-text-secondary,#646a73);--wm-text-3:var(--fn-text-tertiary,#8f959e);--wm-line:var(--fn-border-secondary,#eff0f1);--wm-hover:var(--fn-bg-hover,#f2f3f5);--wm-bg:var(--fn-bg-container,#fff);--wm-blue:#3370ff;--wm-blue-soft:rgba(51,112,255,.1);
  position:relative;display:flex;flex-direction:column;flex:1;min-height:0;height:100%;background:var(--wm-bg);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif}
.wmfv-bar{container-type:inline-size;display:flex;align-items:center;gap:10px;padding:0 12px 0 16px;height:48px;flex:none;border-bottom:1px solid var(--wm-line);background:var(--wm-bg)}
.wmfv-brand{display:flex;align-items:center;gap:8px;flex:none;font:inherit;font-weight:600;font-size:14px;letter-spacing:.2px;color:var(--wm-text);cursor:pointer;user-select:none;border:0;background:transparent;padding:4px 6px;margin-left:-6px;border-radius:6px}
.wmfv-brand:hover{background:var(--wm-hover)}
.wmfv-dialog.wmfv-about p{word-break:normal;overflow-wrap:anywhere}
.wmfv-about p+p{margin-top:10px}
.wmfv-about a{color:var(--wm-blue);text-decoration:none}
.wmfv-about a:hover{text-decoration:underline}
.wmfv-about .wmfv-links{display:flex;gap:16px;margin-top:12px;font-size:14px}
.wmfv-brand img{width:20px;height:20px;display:block}
.wmfv-divider{width:1px;height:16px;background:var(--wm-line);flex:none}
.wmfv-meta{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}
.wmfv-name{font-size:14px;font-weight:500;color:var(--wm-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wmfv-kind{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;color:#fff;font-size:11px;font-weight:700;line-height:1;letter-spacing:0}
.wmfv-kind[data-kind=pdf]{font-size:7px;letter-spacing:-.2px}
.wmfv-tag{flex:none;font-size:11px;line-height:18px;padding:0 6px;border-radius:4px;background:var(--wm-hover);color:var(--wm-text-2);text-transform:uppercase;letter-spacing:.3px}
.wmfv-status{font-size:12px;color:var(--wm-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.wmfv-status[data-tone=warn]{color:#ff8800}
.wmfv-status[data-tone=error]{color:#f54a45}
.wmfv-actions{display:flex;align-items:center;gap:2px;flex:none}
.wmfv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 8px;border-radius:6px;border:0;background:transparent;color:var(--wm-text-2);cursor:pointer;font-size:14px;white-space:nowrap;flex:none;transition:background .15s,color .15s}
.wmfv-btn svg{width:18px;height:18px;flex:none}
.wmfv-btn .wmfv-lbl{display:none}
.wmfv-btn:hover:not(:disabled){background:var(--wm-hover);color:var(--wm-text)}
.wmfv-btn:disabled{color:var(--wm-text-3);opacity:.45;cursor:default}
.wmfv-btn[data-primary]:not(:disabled){color:var(--wm-blue)}
.wmfv-btn[data-primary]:not(:disabled):hover{background:var(--wm-blue-soft);color:var(--wm-blue)}
.wmfv-sep{width:1px;height:16px;background:var(--wm-line);margin:0 6px}
@container (max-width: 520px){.wmfv-bar .wmfv-brand span{display:none}.wmfv-bar .wmfv-status{display:none}}
@container (max-width: 380px){.wmfv-bar .wmfv-tag{display:none}}
.wmfv-body{position:relative;flex:1;min-height:0}
.wmfv-body iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.wmfv-overlay{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;color:var(--wm-text-3);background:var(--wm-bg);font-size:14px}
.wmfv-root[data-expanded]{position:fixed;inset:20px;height:auto;z-index:1000;border:1px solid rgba(31,35,41,.08);border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(31,35,41,.16),0 2px 8px rgba(31,35,41,.06)}
.wmfv-backdrop{position:fixed;inset:0;z-index:999;background:rgba(31,35,41,.24);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
[data-dock-resizing] .wmfv-body iframe{pointer-events:none}
.wmfv-mask{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(31,35,41,.18);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.wmfv-dialog{width:min(400px,calc(100% - 32px));background:var(--wm-bg);border-radius:12px;padding:24px;box-shadow:0 16px 48px rgba(31,35,41,.18);animation:wmfv-pop .16s ease-out}
.wmfv-dialog h3{margin:0 0 8px;font-size:16px;font-weight:600;color:var(--wm-text)}
.wmfv-dialog p{margin:0;font-size:14px;line-height:22px;color:var(--wm-text-2);word-break:break-all}
.wmfv-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}
.wmfv-dbtn{height:32px;padding:0 16px;border-radius:6px;font-size:14px;cursor:pointer;border:1px solid #d0d3d6;background:var(--wm-bg);color:var(--wm-text);transition:background .15s,border-color .15s}
.wmfv-dbtn:hover{background:var(--wm-hover)}
.wmfv-dbtn[data-primary]{border-color:var(--wm-blue);background:var(--wm-blue);color:#fff}
.wmfv-dbtn[data-primary]:hover{background:#4e83fd;border-color:#4e83fd}
.wmfv-dbtn[data-danger]{color:#f54a45}
@keyframes wmfv-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
`;

let styleInjected = false;
function injectStyle(): void {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.dataset.officeEditor = "";
  el.textContent = css;
  document.head.appendChild(el);
}

const ICONS = {
  save: "M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7",
  download: "M12 3v12m0 0-5-5m5 5 5-5M4 21h16",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  minimize: "M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
} as const;

/** Toolbar button: icon + label; the label hides when the bar is narrow. */
export function ToolButton(props: {
  icon: keyof typeof ICONS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className="wmfv-btn"
      data-primary={props.primary ? "" : undefined}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICONS[props.icon]} />
      </svg>
      <span className="wmfv-lbl">{props.label}</span>
    </button>
  );
}

/** File-type badge: the app's brand colour, shared with the editor accents. */
const KINDS: Record<string, { color: string; mark: string } | undefined> = {
  doc: { color: "#2f6bf2", mark: "W" },
  sheet: { color: "#1fa463", mark: "S" },
  slide: { color: "#f06a2b", mark: "P" },
  pdf: { color: "#e64545", mark: "PDF" },
};
const EXT_KIND: Record<string, string> = {
  docx: "doc", docm: "doc", dotx: "doc", dotm: "doc", doc: "doc", odt: "doc", rtf: "doc",
  xlsx: "sheet", xlsm: "sheet", xlsb: "sheet", xltx: "sheet", xltm: "sheet", xls: "sheet", ods: "sheet", csv: "sheet", tsv: "sheet",
  pptx: "slide", pptm: "slide", ppsx: "slide", ppsm: "slide", potx: "slide", potm: "slide", ppt: "slide", odp: "slide",
  pdf: "pdf", xps: "pdf", oxps: "pdf", djvu: "pdf", ofd: "pdf",
};
function kindOf(ext: string): string {
  return EXT_KIND[ext.toLowerCase()] ?? "";
}

export interface DialogAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}

/** In-frame confirm dialog (replaces window.confirm). */
export function Dialog(props: { title: string; message: string; actions: DialogAction[] }) {
  return (
    <div className="wmfv-mask" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="wmfv-dialog">
        <h3>{props.title}</h3>
        <p>{props.message}</p>
        <div className="wmfv-dialog-actions">
          {props.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="wmfv-dbtn"
              data-primary={a.primary ? "" : undefined}
              data-danger={a.danger ? "" : undefined}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Attribution and license notices required by ONLYOFFICE's AGPL terms. */
export function AboutDialog(props: {
  title: string;
  paragraphs: string[];
  links: { label: string; href: string }[];
  okLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="wmfv-mask" role="dialog" aria-modal="true" aria-label={props.title} onClick={props.onClose}>
      <div className="wmfv-dialog wmfv-about" style={{ width: "min(480px, calc(100% - 32px))" }} onClick={(e) => e.stopPropagation()}>
        <h3>{props.title}</h3>
        {props.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <div className="wmfv-links">
          {props.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </div>
        <div className="wmfv-dialog-actions">
          <button type="button" className="wmfv-dbtn" data-primary="" onClick={props.onClose}>
            {props.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell(props: ShellProps) {
  injectStyle();
  const kind = KINDS[kindOf(props.ext)];
  return (
    <>
    {props.expanded && <div className="wmfv-backdrop" onClick={props.onBackdropClick} />}
    <div
      className="wmfv-root"
      data-expanded={props.expanded ? "" : undefined}
    >
      <div className="wmfv-bar">
        <button type="button" className="wmfv-brand" title={props.brandLabel} onClick={props.onBrandClick}>
          <img src={BRAND_LOGO} alt="" />
          <span>{BRAND_NAME}</span>
        </button>
        <span className="wmfv-divider" />
        <span className="wmfv-meta">
          {kind ? (
            <span className="wmfv-kind" data-kind={kindOf(props.ext)} style={{ background: kind.color }} title={props.ext.toUpperCase()}>
              {kind.mark}
            </span>
          ) : (
            <span className="wmfv-tag">{props.ext}</span>
          )}
          <span className="wmfv-name" title={props.fileName}>
            {props.fileName}
          </span>
          <span
            className="wmfv-status"
            data-tone={props.statusTone ?? "normal"}
            title={typeof props.status === "string" ? props.status : undefined}
          >
            {props.status}
          </span>
        </span>
        <span className="wmfv-actions">{props.actions}</span>
      </div>
      <div className="wmfv-body">{props.children}</div>
      {props.dialog}
    </div>
    </>
  );
}
