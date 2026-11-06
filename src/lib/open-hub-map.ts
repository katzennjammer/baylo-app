import type { useRouter } from "expo-router";

/**
 * Open the Safe hubs map (the Marketplace tab's map view) centred on ONE hub,
 * with that hub selected.
 *
 * This replaced the separate /hubs screen (6 Nov 2026). That screen opened on
 * the viewer's own location rather than on the hub they had tapped, so a tap
 * on a listing's map preview landed somewhere with no pin in sight. Now every
 * "show me this hub on the map" goes to the one real map.
 *
 * `applyAt` is the nonce Marketplace reads arriving params with: without it,
 * tapping the same hub a second time would change nothing.
 */
export function openHubOnMap(router: Pick<ReturnType<typeof useRouter>, "push">, hubId: string) {
  router.push({ pathname: "/(app)/marketplace", params: { hub: hubId, applyAt: String(Date.now()) } });
}
