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
 * The cleartext part does not fire for local development: the variable is
 * unset, and debug builds keep getting cleartext the way they always have. The
 * Google Sign-In plugin below is added in every build.
 */
/**
 * NATIVE GOOGLE SIGN-IN. `@react-native-google-signin/google-signin`'s plugin
 * has two modes, and the one WITHOUT options assumes Firebase: it applies the
 * google-services Gradle plugin, which fails the Android build without a
 * google-services.json. So it is always given options here.
 *
 * Its only option, `iosUrlScheme`, is the iOS client id reversed
 * (`com.googleusercontent.apps.<id without the domain>`). It is derived from
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID rather than typed into app.json, so there is
 * one place the id lives. With no iOS id set (an EAS Android build, whose env
 * comes from eas.json) a placeholder satisfies the plugin's validation; it
 * only affects iOS, which is untested.
 */
function googleSignInPlugin() {
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim();
  const suffix = ".apps.googleusercontent.com";
  const iosUrlScheme = iosClientId.endsWith(suffix)
    ? `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`
    : "com.googleusercontent.apps.unconfigured";
  return ["@react-native-google-signin/google-signin", { iosUrlScheme }];
}

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? []), googleSignInPlugin()];

  if (process.env.BAYLO_ALLOW_CLEARTEXT === "1") {
    plugins.push(["expo-build-properties", { android: { usesCleartextTraffic: true } }]);
  }

  return { ...config, plugins };
};
