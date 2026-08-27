/// <reference types="nativewind/types" />

/**
 * Metro turns `import "./global.css"` into the Tailwind build step; TypeScript
 * has no idea what a .css file is and rejects the side-effect import outright
 * (TS2882). This tells it the module exists and exports nothing, which is
 * exactly true of what Metro produces.
 */
declare module "*.css";
