// Preload for Node-run checks of PURE presentation code (`--require`): every
// native or runtime package resolves to an inert proxy, so a module like
// src/components/trades/present.ts can be imported without the React Native
// toolchain. Nothing that runs under it may depend on those packages working.
const Module = require("module");

const STUB = /^(react|react\/.*|react-native(\/.*)?|react-native-.*|@react-native.*|expo|expo-.*|@expo\/.*|@tanstack\/.*|@react-navigation\/.*|pusher-js)$/;

const inert = () =>
  new Proxy(function () {}, {
    get: (_t, key) => (key === "__esModule" ? true : key === Symbol.toPrimitive ? () => "" : inert()),
    apply: () => inert(),
    construct: () => inert(),
  });

const load = Module._load;
Module._load = function (request, ...rest) {
  return STUB.test(request) ? inert() : load.call(this, request, ...rest);
};
