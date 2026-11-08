import { defineConfig } from "vite";

// One self-contained ESM file. React comes from the host page
// (window.__OCTOP_REACT__), so JSX compiles to React.createElement against a
// module-level `React` binding defined in ui/src/react.ts.
export default defineConfig({
  // public/ is the plugin's served editor bundle, not Vite static assets;
  // without this Vite copies all of it into ui/dist.
  publicDir: false,
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  build: {
    outDir: "ui/dist",
    emptyOutDir: true,
    lib: {
      entry: "ui/src/index.tsx",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    cssCodeSplit: false,
    minify: true,
  },
});
