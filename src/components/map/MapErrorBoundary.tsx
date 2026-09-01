import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { SafeZoneHub } from "../../api/types";
import { PinIcon, RefreshIcon, WarningIcon } from "../icons";
import { Tappable } from "../Tappable";
import {
  border,
  color,
  icon,
  radius,
  size,
  space,
  textStyle,
  type,
} from "../../theme/tokens";
import { openDirections } from "./directions";

/**
 * Keeps a broken map from taking the screen with it.
 *
 * ── WHAT IT IS ACTUALLY DEFENDING AGAINST ───────────────────────────────────
 *
 * The map is a WebView running 160 KB of vendored Leaflet against a document
 * this app generates. That is three things that can fail independently of the
 * React tree around them, and when one did, the whole screen went blank —
 * because an uncaught render error unmounts the nearest tree that has no
 * boundary, and this app had none. A "the map broke" bug therefore presented
 * as "the Safe Zones screen is white", which is the same artefact as a hanging
 * request and an unreachable Metro, and told you nothing.
 *
 * The hubs are the point of the screen; the map is one presentation of them.
 * So the fallback is not an apology, it is THE SAME DATA AS A LIST — names,
 * landmarks and directions links, which is every part of a Safe Zone that
 * matters except the picture. A person who lands on the fallback can still get
 * to a hub. That is the whole design goal.
 *
 * ── IT CATCHES TWO DIFFERENT KINDS OF FAILURE ───────────────────────────────
 *
 *   1. A RENDER ERROR anywhere under it — react-native-webview throwing, a hub
 *      payload the document builder cannot handle, a bad style. This is the
 *      ordinary error-boundary case and `getDerivedStateFromError` has it.
 *
 *   2. THE WEBVIEW'S RENDER PROCESS DYING, which is not a JS error at all. On
 *      Android the system kills the WebView's process under memory pressure and
 *      react-native-webview reports it through `onRenderProcessGone`; the view
 *      is then permanently blank with nothing thrown anywhere. `HubMap` turns
 *      that callback into a thrown error precisely so it arrives HERE, and both
 *      kinds of failure degrade to one fallback instead of two.
 *
 * That second path is why `HubMap` throws during render rather than handling
 * its own crash: one boundary, one fallback, one place that decides what
 * degraded looks like.
 *
 * ── RESETTING ───────────────────────────────────────────────────────────────
 *
 * "Try the map again" clears the error and remounts the subtree via `attempt`,
 * which is part of the child `key`. A WebView killed for memory very often
 * comes back fine, so a retry is worth offering — but it is a BUTTON and never
 * automatic, because a map that crashes in a loop would otherwise retry in a
 * loop and take the battery with it.
 */

interface MapErrorBoundaryProps {
  /** Rendered as the fallback list. The same array the map was given. */
  hubs: SafeZoneHub[];
  /** Opens a hub's listings. Omitted where there is nowhere to go. */
  onOpenHub?: (hubId: string) => void;
  /**
   * False where the SCREEN already lists these hubs as text.
   *
   * Item detail is the case: its map is a small preview with the full hub list
   * printed directly underneath it, so a fallback that listed them again would
   * put the same eleven rows on screen twice. There the degraded state is just
   * the notice — the list it would have drawn is already three lines below.
   */
  listHubs?: boolean;
  children: ReactNode;
}

interface MapErrorBoundaryState {
  error: Error | null;
  /** Bumped on every reset, so the remount is a real remount. */
  attempt: number;
}

export class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<MapErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Logged rather than swallowed. The fallback is deliberately calm and does
    // not show a stack, so without this line a WebView failure would be
    // invisible in development too — and "the map quietly became a list" is
    // exactly the kind of degradation that goes unnoticed for weeks.
    console.warn("[HubMap] fell back to the hub list:", error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <HubListFallback
          hubs={this.props.hubs}
          onOpenHub={this.props.onOpenHub}
          listHubs={this.props.listHubs ?? true}
          onRetry={() =>
            this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }))
          }
        />
      );
    }

    // The key is what makes "Try again" mean anything: without it React reuses
    // the existing element and a WebView that is already dead stays dead.
    return (
      <View key={this.state.attempt} style={s.fill}>
        {this.props.children}
      </View>
    );
  }
}

/**
 * The degraded map: every hub the map would have pinned, as rows.
 *
 * Ordered exactly as given — the same order the pins were in — so somebody
 * moving between the two presentations is not also re-learning a sort.
 */
function HubListFallback({
  hubs,
  onOpenHub,
  listHubs,
  onRetry,
}: {
  hubs: SafeZoneHub[];
  onOpenHub?: (hubId: string) => void;
  listHubs: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={s.fallback}>
      <View style={s.banner}>
        <WarningIcon
          size={icon.offlineWarning.size}
          stroke={icon.offlineWarning.stroke}
          color={color.urgent}
        />
        <Text style={[textStyle(type.hubLandmark), s.bannerText]}>
          {listHubs
            ? "The map could not be drawn. Every Safe Zone is listed below."
            : "The map could not be drawn. The Safe Zones are listed below."}
        </Text>
        <Tappable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try loading the map again"
          style={s.retry}
          pressedStyle={s.retryPressed}
        >
          <RefreshIcon
            size={icon.retryPhoto.size}
            stroke={icon.retryPhoto.stroke}
            color={color.forest}
          />
          <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>
            Try the map again
          </Text>
        </Tappable>
      </View>

      {!listHubs ? null : hubs.length === 0 ? (
        <View style={s.empty}>
          <Text style={[textStyle(type.hubLandmark), s.emptyText]}>
            No Safe Zones to list.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.rows} showsVerticalScrollIndicator={false}>
          {hubs.map((hub) => (
            <HubRow key={hub.id} hub={hub} onOpenHub={onOpenHub} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * One hub, with the landmark intact.
 *
 * The landmark is never truncated here for the same reason it is not truncated
 * in `HubSheet`: it is the sentence that gets two people to the same spot, and
 * on this screen it is doing the job the map is no longer doing.
 */
function HubRow({ hub, onOpenHub }: { hub: SafeZoneHub; onOpenHub?: (hubId: string) => void }) {
  return (
    <View style={s.row}>
      <View style={[s.iconWell, !hub.isActive && s.iconWellOff]}>
        <PinIcon
          size={icon.hubPin.size}
          stroke={icon.hubPin.stroke}
          color={hub.isActive ? color.forest : color.inkStale}
        />
      </View>

      <View style={s.rowBody}>
        <Text style={[textStyle(type.hubName), s.rowName]} numberOfLines={2}>
          {hub.name}
        </Text>
        <Text style={[textStyle(type.hubLandmark), s.rowMeta]} numberOfLines={1}>
          {`${hub.typeLabel} · ${hub.city}`}
        </Text>
        <Text style={[textStyle(type.hubLandmark), s.rowLandmark]}>
          {hub.isActive ? hub.landmark : "No longer a Safe Zone — agree somewhere else"}
        </Text>

        <View style={s.rowActions}>
          <Tappable
            onPress={() => {
              void openDirections({
                latitude: hub.latitude,
                longitude: hub.longitude,
                name: hub.name,
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${hub.name}`}
            style={s.action}
            pressedStyle={s.actionPressed}
          >
            <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>
              Directions
            </Text>
          </Tappable>

          {/* Same rule as HubSheet: a deactivated hub has no listings page
              worth opening, so the control is absent rather than disabled. */}
          {onOpenHub && hub.isActive ? (
            <Tappable
              onPress={() => onOpenHub(hub.id)}
              accessibilityRole="button"
              accessibilityLabel={`See listings at ${hub.name}`}
              style={s.action}
              pressedStyle={s.actionPressed}
            >
              <Text style={[textStyle(type.secondaryButton), { color: color.forest }]}>
                Listings
              </Text>
            </Tappable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },

  fallback: {
    flex: 1,
    borderRadius: radius.gridPhoto,
    overflow: "hidden",
    backgroundColor: color.inset,
  },

  banner: {
    alignItems: "center",
    gap: space.detail.headingToBody,
    paddingHorizontal: space.empty.x,
    paddingVertical: space.card.top,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.controlLine,
    backgroundColor: color.urgentWash,
  },
  bannerText: { color: color.inkSecondary, textAlign: "center" },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.card.socialGap,
    height: size.control.reloadButton,
    paddingHorizontal: size.control.reloadButtonX,
    borderRadius: radius.reloadButton,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  retryPressed: { backgroundColor: color.greenLine },

  rows: { paddingVertical: space.card.top },

  row: {
    flexDirection: "row",
    gap: space.header.gap,
    paddingHorizontal: space.empty.x,
    paddingVertical: space.card.top,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.greenWash,
  },
  iconWellOff: { backgroundColor: color.control },

  rowBody: { flex: 1, gap: space.detail.hubNameToLandmark },
  rowName: { color: color.ink },
  rowMeta: { color: color.inkMuted },
  rowLandmark: { color: color.inkSecondary },

  rowActions: {
    flexDirection: "row",
    gap: space.card.socialGap,
    marginTop: space.detail.hubNameToLandmark,
  },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.hubRow,
    borderWidth: border.hairline,
    borderColor: color.greenLine,
    backgroundColor: color.greenWash,
  },
  actionPressed: { backgroundColor: color.greenLine },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.empty.x },
  emptyText: { color: color.inkSecondary, textAlign: "center" },
});
