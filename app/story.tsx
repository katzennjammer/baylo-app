import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { CloseIcon, ImageIcon, KebabIcon, SwapIcon } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { CountdownPill } from "../src/components/CountdownPill";
import { ReportSheet } from "../src/components/ReportSheet";
import { showDialog } from "../src/components/dialog";
import { ApiError } from "../src/api/client";
import { useReport } from "../src/api/item";
import {
  patchStoriesSeen,
  useDeleteStory,
  useMarkStorySeen,
  useStories,
  type StoryAuthor,
} from "../src/api/stories";
import { listingArea } from "../src/lib/listing-area";
import { relativeShort } from "../src/lib/format";
import { border, color, icon, radius, size, space, textStyle, type } from "../src/theme/tokens";

/**
 * The full-screen story viewer (2 Oct 2026). Opened from the stories row with
 * `authorId`; plays that author's stories, then carries on to the next author
 * in the row, Instagram-style, and closes after the last.
 *
 * ── GESTURES: ONE RESPONDER DECIDES ─────────────────────────────────────────
 *
 * A single PanResponder over the photo tells the three apart, so nothing
 * competes for the touch (the app has no gesture-handler root, and three
 * separate recognisers on Android is where taps get eaten):
 *
 *   tap         left third = previous, the rest = next
 *   hold        past HOLD_MS the story pauses; releasing resumes it
 *   swipe down  past CLOSE_DY (or a quick flick) closes; a short drag springs
 *               back and resumes
 *
 * The header and the bottom card sit ABOVE that layer, so their buttons get
 * their own taps and are never read as "next".
 *
 * ── SEEN ────────────────────────────────────────────────────────────────────
 *
 * Each story is reported seen as it appears (not your own). The row's cache is
 * patched only when the viewer CLOSES: patching mid-view would re-sort the row
 * under the snapshot being played. The snapshot itself is taken once, for the
 * same reason -- a background refetch must not move the story being watched.
 */

const DURATION_MS = 5000;
const HOLD_MS = 220;
const CLOSE_DY = 120;

export default function StoryViewer() {
  const { authorId } = useLocalSearchParams<{ authorId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data } = useStories();

  // The row as it was when the viewer opened. See the file note.
  const [authors] = useState<StoryAuthor[]>(() => data ?? []);
  const [authorIdx, setAuthorIdx] = useState(() =>
    Math.max(0, authors.findIndex((a) => a.user.id === authorId)),
  );
  const [storyIdx, setStoryIdx] = useState(() => firstUnseen(authors[authorIdx]));

  const author = authors[authorIdx];
  const story = author?.stories[storyIdx];

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  // A stale link, or a row that emptied: nothing to play.
  useEffect(() => {
    if (!story) close();
  }, [story, close]);

  /* ── navigation between stories ─────────────────────────────────────── */

  const next = useCallback(() => {
    if (!author) return;
    if (storyIdx < author.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (authorIdx < authors.length - 1) {
      setAuthorIdx(authorIdx + 1);
      setStoryIdx(firstUnseen(authors[authorIdx + 1]));
    } else {
      close();
    }
  }, [author, storyIdx, authorIdx, authors, close]);

  const prev = useCallback(() => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (authorIdx > 0) {
      setAuthorIdx(authorIdx - 1);
      setStoryIdx(0);
    } else restart();
    // `restart` is stable (refs only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIdx, authorIdx]);

  /* ── the progress clock ─────────────────────────────────────────────── */

  const progress = useRef(new Animated.Value(0)).current;
  const pausedAt = useRef(0);
  const pauses = useRef(0); // a hold, a menu and a sheet can overlap
  const nextRef = useRef(next);
  nextRef.current = next;

  const run = useCallback(
    (from: number) => {
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(0, (1 - from) * DURATION_MS),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) nextRef.current();
      });
    },
    [progress],
  );

  const pause = useCallback(() => {
    pauses.current += 1;
    progress.stopAnimation((v) => {
      pausedAt.current = v;
    });
  }, [progress]);

  const resume = useCallback(() => {
    pauses.current = Math.max(0, pauses.current - 1);
    if (pauses.current === 0) run(pausedAt.current);
  }, [run]);

  const restart = useCallback(() => {
    progress.stopAnimation();
    progress.setValue(0);
    pausedAt.current = 0;
    if (pauses.current === 0) run(0);
  }, [progress, run]);

  // A new story starts its clock from zero.
  useEffect(() => {
    if (!story) return;
    restart();
    return () => progress.stopAnimation();
  }, [story?.id, restart, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── seen ───────────────────────────────────────────────────────────── */

  const { mutate: markSeen } = useMarkStorySeen();
  const seenIds = useRef<string[]>([]);
  useEffect(() => {
    if (!story || !author || author.isOwn || story.seen) return;
    if (seenIds.current.includes(story.id)) return;
    seenIds.current.push(story.id);
    markSeen(story.id);
  }, [story, author, markSeen]);
  useEffect(() => () => patchStoriesSeen(qc, seenIds.current), [qc]);

  /* ── gestures ───────────────────────────────────────────────────────── */

  const dragY = useRef(new Animated.Value(0)).current;
  const handlers = useRef({ prev, next, pause, resume, close });
  handlers.current = { prev, next, pause, resume, close };

  const responder = useMemo(() => {
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let held = false;
    let dragging = false;
    let startX = 0;
    const clearHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
    };
    const settle = () => {
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.locationX;
        held = false;
        dragging = false;
        holdTimer = setTimeout(() => {
          held = true;
          handlers.current.pause();
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (!dragging && g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx)) {
          dragging = true;
          clearHold();
          if (!held) {
            held = true;
            handlers.current.pause();
          }
        }
        if (dragging) dragY.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        clearHold();
        if (dragging) {
          dragging = false;
          if (g.dy > CLOSE_DY || g.vy > 0.9) {
            handlers.current.close();
            return;
          }
          settle();
        }
        if (held) {
          held = false;
          handlers.current.resume();
          return;
        }
        if (startX < width / 3) handlers.current.prev();
        else handlers.current.next();
      },
      onPanResponderTerminate: () => {
        clearHold();
        dragging = false;
        settle();
        if (held) {
          held = false;
          handlers.current.resume();
        }
      },
    });
  }, [dragY, width]);

  /* ── menu: delete your own, report someone else's ───────────────────── */

  const { mutate: deleteStory } = useDeleteStory();
  const report = useReport();
  const [reporting, setReporting] = useState(false);

  const openMenu = () => {
    if (!story || !author) return;
    pause();
    if (author.isOwn) {
      showDialog("Delete this story?", "It leaves your story right away. Your listing stays up.", [
        { text: "Cancel", style: "cancel", onPress: resume },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteStory(story.id, {
              onSuccess: close,
              onError: () => {
                showDialog("Couldn't delete the story", "Check your connection and try again.", [
                  { text: "OK", onPress: resume },
                ]);
              },
            }),
        },
      ]);
    } else {
      showDialog(`${author.user.name}'s story`, undefined, [
        { text: "Cancel", style: "cancel", onPress: resume },
        { text: "Report story", style: "destructive", onPress: () => setReporting(true) },
      ]);
    }
  };

  const onReport = (category: string) => {
    if (!story) return;
    report.mutate(
      { targetType: "story", targetId: story.id, category },
      {
        onSuccess: () => {
          setReporting(false);
          showDialog("Thanks for reporting", "A moderator will look at this story.", [
            { text: "OK", onPress: resume },
          ]);
        },
        onError: (e) => {
          setReporting(false);
          const already = e instanceof ApiError && e.status === 409;
          showDialog(
            already ? "Already reported" : "Couldn't send the report",
            already ? "You've already reported this story." : "Check your connection and try again.",
            [{ text: "OK", onPress: resume }],
          );
        },
      },
    );
  };

  /* ── leaving for the listing ────────────────────────────────────────── */

  const openListing = () => {
    if (!story) return;
    const id = story.item.id;
    close();
    router.push({ pathname: "/item", params: { id } });
  };

  if (!story || !author) return <View style={s.root} />;

  const item = story.item;
  const cover = item.images[0];
  const area = listingArea(item);
  const when = relativeShort(story.createdAt);
  const opacity = dragY.interpolate({ inputRange: [0, 400], outputRange: [1, 0.4], extrapolate: "clamp" });

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <Animated.View style={[s.stage, { opacity, transform: [{ translateY: dragY }] }]}>
        {/* ── the photo, and the gesture layer over it ── */}
        {cover ? (
          <Image source={{ uri: cover }} contentFit="contain" style={StyleSheet.absoluteFill} transition={120} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.noPhoto]}>
            <ImageIcon size={icon.failedPhoto.size} stroke={icon.failedPhoto.stroke} color={color.failedIcon} />
          </View>
        )}
        <View
          style={StyleSheet.absoluteFill}
          {...responder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Story ${storyIdx + 1} of ${author.stories.length} from ${author.user.name}: ${item.title}`}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "escape" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") next();
            else if (e.nativeEvent.actionName === "decrement") prev();
            else close();
          }}
        />

        {/* ── top: progress, author, menu, close ── */}
        <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={s.bars}>
            {author.stories.map((st, i) => (
              <View key={st.id} style={s.bar}>
                <Animated.View
                  style={[
                    s.barFill,
                    {
                      width:
                        i < storyIdx
                          ? "100%"
                          : i > storyIdx
                            ? "0%"
                            : progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          <View style={s.authorRow}>
            <Avatar uri={author.user.avatar} name={author.user.name} />
            <Text style={[textStyle(type.username), s.onDark]} numberOfLines={1}>
              {author.isOwn ? "Your story" : author.user.name}
            </Text>
            {when ? <Text style={[textStyle(type.metadata), s.onDarkMuted]}>{when}</Text> : null}
            <View style={{ flex: 1 }} />
            <Tappable
              onPress={openMenu}
              accessibilityRole="button"
              accessibilityLabel={author.isOwn ? "Story options" : "More options"}
              style={s.iconButton}
              pressedStyle={s.iconPressed}
            >
              <KebabIcon size={icon.kebab.size} color={color.onScrim} />
            </Tappable>
            <Tappable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close story"
              style={s.iconButton}
              pressedStyle={s.iconPressed}
            >
              <CloseIcon size={22} stroke={2} color={color.onScrim} />
            </Tappable>
          </View>
        </View>

        {/* ── bottom: caption, then the listing card ── */}
        <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          {story.caption ? (
            <View style={s.caption} pointerEvents="none">
              <Text style={[textStyle(type.emptyBody), s.onDark]}>{story.caption}</Text>
            </View>
          ) : null}

          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.thumbBox}>
                {cover ? (
                  <Image source={{ uri: cover }} contentFit="cover" style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.noPhoto]} />
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[textStyle(type.gridTitle), { color: color.ink }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {area ? (
                  <Text style={[textStyle(type.gridMeta), { color: color.inkMuted }]} numberOfLines={1}>
                    {area}
                  </Text>
                ) : null}
                {item.perishable ? (
                  <CountdownPill expiresAt={item.perishable.expiresAt} expired={item.perishable.expired} />
                ) : null}
              </View>
            </View>

            <View style={s.actions}>
              <Tappable
                onPress={openListing}
                accessibilityRole="button"
                accessibilityLabel={`View listing: ${item.title}`}
                style={[s.action, s.viewAction]}
                pressedStyle={s.viewPressed}
              >
                <Text style={[textStyle(type.secondaryButton), { color: color.ink }]} numberOfLines={1}>
                  View listing
                </Text>
              </Tappable>
              {author.isOwn ? null : (
                <Tappable
                  onPress={openListing}
                  accessibilityRole="button"
                  accessibilityLabel={`Offer a trade for ${item.title}`}
                  style={[s.action, s.offerAction]}
                  pressedStyle={s.offerPressed}
                >
                  <SwapIcon size={icon.offer.size} stroke={icon.offer.stroke} color={color.forest} />
                  <Text style={[textStyle(type.secondaryButton), { color: color.forest }]} numberOfLines={1}>
                    Offer trade
                  </Text>
                </Tappable>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {reporting ? (
        <ReportSheet
          target="story"
          targetName="this story"
          busy={report.isPending}
          onPick={onReport}
          onClose={() => {
            setReporting(false);
            resume();
          }}
        />
      ) : null}
    </View>
  );
}

/** The first story this viewer has not seen, else the first. */
function firstUnseen(author: StoryAuthor | undefined): number {
  if (!author) return 0;
  const i = author.stories.findIndex((s) => !s.seen);
  return i === -1 ? 0 : i;
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) return <Image source={{ uri }} contentFit="cover" style={s.avatar} />;
  return (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={[textStyle(type.avatarInitials40), { color: color.forest }]}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const AVATAR = 32;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  stage: { flex: 1 },
  noPhoto: { alignItems: "center", justifyContent: "center", backgroundColor: color.ink },

  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.screenX - 6 },
  bars: { flexDirection: "row", gap: 4, paddingHorizontal: 6 },
  bar: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.35)" },
  barFill: { height: 3, backgroundColor: color.onScrim },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingLeft: 6 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: color.greenWash },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  onDark: { color: color.onScrim, flexShrink: 1 },
  onDarkMuted: { color: "rgba(255,255,255,0.75)" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  iconPressed: { opacity: 0.6 },

  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.screenX, gap: 10 },
  caption: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.photoCaption + 6,
    backgroundColor: color.captionFill,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.gridTile + 4,
    padding: 12,
    gap: 12,
  },
  cardRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  thumbBox: { width: 64, height: 64, borderRadius: radius.gridTile, overflow: "hidden", backgroundColor: color.control },
  thumb: { width: "100%", height: "100%" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.card.offerGap,
    minHeight: size.control.offerInline,
    paddingHorizontal: size.control.offerInlineX,
    borderRadius: radius.offerInline,
    borderWidth: border.chip,
  },
  viewAction: { borderColor: color.controlLineStrong },
  viewPressed: { backgroundColor: color.control },
  offerAction: { borderColor: color.forest },
  offerPressed: { backgroundColor: color.greenWash },
});
