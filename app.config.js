/**
 * app.json is still the source of truth. This file layers on the one piece of
 * native config that has to differ between an internal APK and a store build,
 * and cannot be expressed in app.json at all.
 *
 * CLEARTEXT HTTP. Debug builds get `android:usesCleartextTraffic="true"` from
 * the manifest prebuild writes into `android/app/src/debug/`. Release builds do
 * not, and Android has blocked cleartext by default since API 28 — so a release
 * APK pointed at `http://<laptop>:3000` fails every request with a network
 * error that looks nothing like a configuration problem.
 *
 * The `preview` profile in eas.json is exactly that build: a release APK
 * talking to the dev server over the phone's hotspot, in plain HTTP. It sets
 * BAYLO_ALLOW_CLEARTEXT=1 and gets the permission. Nothing else does — the
 * `production` profile must not, because a store build talks HTTPS to a
 * deployed backend and shipping a blanket cleartext exemption to the Play Store
 * is how you fail a security review.
 *
 * `expo.android.usesCleartextTraffic` is not a key the Expo config schema
 * accepts; `expo-build-properties` is the supported way to reach it.
 *
 * Nothing here fires for local development: the variable is unset, this returns
 * app.json untouched, and debug builds keep getting cleartext the way they
 * always have.
 */
module.exports = ({ config }) => {
  if (process.env.BAYLO_ALLOW_CLEARTEXT !== "1") return config;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
    ],
  };
};
