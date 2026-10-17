// Preload, AFTER rn-stub.cjs: replaces the inert expo-secure-store proxy with an
// in-memory Map, so a check can read back what the app wrote. Exposed as
// globalThis.__secureStore. Nothing here touches a device or a server.
const Module = require("module");

const store = new Map();
globalThis.__secureStore = store;

const fake = {
  __esModule: true,
  getItemAsync: async (key) => (store.has(key) ? store.get(key) : null),
  setItemAsync: async (key, value) => {
    store.set(key, String(value));
  },
  deleteItemAsync: async (key) => {
    store.delete(key);
  },
};

const load = Module._load;
Module._load = function (request, ...rest) {
  return request === "expo-secure-store" ? fake : load.call(this, request, ...rest);
};
