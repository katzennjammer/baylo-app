import { useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/** Within this many points of the top counts as "at the top". */
const AT_TOP = 4;

/**
 * Tapping the tab you are ALREADY on: scroll to the top, or refresh if you
 * are already there (22 Oct 2026). The Facebook / Instagram pattern, one tap
 * at a time rather than a double-tap, so it is never triggered by accident.
 *
 * Listens for the `tabPress` that TabBar emits before navigating. A press that
 * switches TO this tab arrives while the screen is not yet focused and is
 * ignored, so coming back to a tab still keeps its scroll position.
 *
 * Returns the `onScroll` handler for the list; it only records whether the
 * list is at the top. Pair it with `scrollEventThrottle={16}`.
 */
export function useTabReselect(scrollToTop: () => void, refresh: () => unknown) {
  const navigation = useNavigation();
  const atTop = useRef(true);
  // Latest callbacks via a ref, so the listener is added once per mount.
  const actions = useRef({ scrollToTop, refresh });
  actions.current = { scrollToTop, refresh };

  useEffect(
    () =>
      navigation.addListener("tabPress" as never, () => {
        if (!navigation.isFocused()) return;
        if (atTop.current) void actions.current.refresh();
        else actions.current.scrollToTop();
      }),
    [navigation],
  );

  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = e.nativeEvent.contentOffset.y <= AT_TOP;
  }, []);
}
