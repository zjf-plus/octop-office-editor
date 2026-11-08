// React is provided by the Octop dashboard; never bundle a second copy.
import type * as ReactNs from "react";

declare global {
  interface Window {
    __OCTOP_REACT__?: typeof ReactNs;
  }
}

const host = window.__OCTOP_REACT__;
if (!host) throw new Error("office editor plugin: host React (window.__OCTOP_REACT__) missing");

export const React: typeof ReactNs = host;
