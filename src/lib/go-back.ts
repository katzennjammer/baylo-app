import type { useRouter } from "expo-router";

type Router = Pick<ReturnType<typeof useRouter>, "back" | "canGoBack" | "replace">;

/**
 * Back, or Home when there is nothing to go back to.
 *
 * `router.back()` assumes a screen underneath. A screen opened by a link
 * (`baylo://settings`, a notification, a cold start on a deep route) is the
 * ONLY screen in the stack, so the action reaches no navigator: in a dev build
 * that is the red "The action 'GO_BACK' was not handled by any navigator", and
 * in a release build it is a back arrow that does nothing at all, on a screen
 * with no tab bar to leave by.
 *
 * "/" rather than a tab's own path: app/index.tsx already decides where a
 * person belongs (the tabs, or sign-in), and this should not decide it twice.
 */
export function goBack(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
