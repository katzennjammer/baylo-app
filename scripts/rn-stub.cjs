// Preload for Node-run checks of PURE presentation code (`--require`): every
// native or runtime package resolves to an inert proxy, so a module like
// src/components/trades/present.ts can be imported without the React Native
// toolchain. Nothing that runs under it may depend on those packages working.
const Module = require("module");

globalThis.__DEV__ = true;

const STUB = /^(react|react\/.*|react-native(\/.*)?|react-native-.*|@react-native.*|expo|expo-.*|@expo\/.*|@tanstack\/.*|@react-navigation\/.*|pusher-js)$/;

const inert = () =>
  new Proxy(function () {}, {
    get: (_t, key) => (key === "__esModule" ? true : key === Symbol.toPrimitive ? () => "" : inert()),
    apply: () => inert(),
    construct: () => inert(),
  });

// Bundled assets. In the app Metro turns `require("./duck.png")` into a number
// (an asset id); under Node the same require would try to run the image as
// JavaScript. Pure code reaches these through ordinary imports -- a copy file
// imports a component file that names a mascot -- so they answer the way Metro
// would: with a number, and without reading the file.
const ASSET = /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|ttf|otf)$/i;

const load = Module._load;
Module._load = function (request, ...rest) {
  if (ASSET.test(request)) return 1;
  return STUB.test(request) ? inert() : load.call(this, request, ...rest);
};
