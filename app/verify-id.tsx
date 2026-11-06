import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { MASCOT } from "../src/media/mascots";

import { ApiError } from "../src/api/client";
import { showDialog } from "../src/components/dialog";
import {
  fetchIdVerification,
  formatSubmittedAt,
  submitIdVerification,
  type IdVerificationPayload,
} from "../src/api/id-verification";
import { PROFILE_ME_KEY } from "../src/api/profile";
import { ChevronLeftIcon } from "../src/components/icons";
import { Tappable } from "../src/components/Tappable";
import { color, radius, textStyle, type } from "../src/theme/tokens";

/**
 * /verify-id — the prompt, the form, and the status, on one route.
 *
 * ── WHY ONE SCREEN AND NOT THREE ────────────────────────────────────────────
 *
 * "Explain why", "submit an ID" and "where is mine up to" look like three
 * screens and are one question asked at three moments — and which one a person
 * needs is not something the app that pushed them here knows. Somebody who
 * tapped Post might be unverified, might have something pending they forgot
 * about, or might have been rejected while they were away. Splitting them means
 * every caller has to fetch the state first to decide where to navigate, and
 * every one of those decisions can be stale by the time the screen mounts.
 *
 * So the route is one, it fetches the state itself, and it renders the branch
 * that is actually true. Callers just `router.push("/verify-id")`.
 *
 * ── OUTSIDE BOTH ROUTE GROUPS, LIKE /verify ─────────────────────────────────
 *
 * At the top level rather than in (app), so a full-screen presentation over
 * whatever pushed it is the default and the tab bar does not sit under it. It
 * still requires a session — every call it makes is authenticated — but it is
 * not part of the tab shell.
 *
 * ── THIS SCREEN DECIDES NOTHING ─────────────────────────────────────────────
 *
 * It reads the state and it submits. The cap, the uniqueness rule and the gate
 * itself are all server-side and all re-checked on every attempt; deleting this
 * file would change what a person can SEE and nothing about what they can DO.
 */

/**
 * A local spacing scale, and why this file does not use `space` from the theme.
 *
 * `space` is not a scale — it is a transcription of one design spec, keyed by
 * the component each number belongs to (`space.card.photoToTitle`,
 * `space.tab.iconToLabel`). That shape is deliberate and it is why a typo in a
 * feed card is a compile error rather than a silent zero, but it means there is
 * nothing in it to reach for on a screen the spec never covered. Inventing
 * `space.verifyId.*` would put a made-up entry into a file whose whole value is
 * that every number in it came from somewhere.
 *
 * So: four steps, local, in the same 8-point rhythm the rest of the app reads
 * in. `postColor`/`postSpace` make the same call one flow over.
 */
const gap = { sm: 8, md: 12, lg: 16, xl: 28 } as const;

export default function VerifyIdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["id-verification"],
    queryFn: fetchIdVerification,
    // No staleTime override: a person landing here from a Post refusal wants
    // the CURRENT answer, and "your ID was approved an hour ago" shown as
    // "pending" is the one wrong answer this screen must not give.
    staleTime: 0,
  });

  if (state.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: color.surface, justifyContent: "center" }}>
        <ActivityIndicator color={color.green} />
      </View>
    );
  }

  if (state.isError || !state.data) {
    return (
      <Shell insets={insets} onBack={() => router.back()}>
        <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
          We could not load this
        </Text>
        <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary, marginTop: gap.sm }]}>
          {state.error instanceof ApiError && state.error.status === 0
            ? "No connection. Try again once you are back online."
            : "Something went wrong at our end. Try again in a moment."}
        </Text>
        <Button label="Try again" onPress={() => state.refetch()} />
      </Shell>
    );
  }

  const data = state.data;

  return (
    <Shell insets={insets} onBack={() => router.back()}>
      {data.verified ? (
        <Approved payload={data} onDone={() => router.back()} />
      ) : data.status === "pending" ? (
        <Pending payload={data} onDone={() => router.back()} />
      ) : data.status === "exhausted" ? (
        <Exhausted payload={data} />
      ) : (
        <SubmitForm
          payload={data}
          onSubmitted={() => {
            qc.invalidateQueries({ queryKey: ["id-verification"] });
            // The offer screen reads the ID state off /profile/me, not off
            // this query, and caches it for a minute. Without this a person
            // who submits and goes straight to an offer sees "Verify your
            // ID" on the DPA row for up to sixty seconds after doing so.
            qc.invalidateQueries({ queryKey: PROFILE_ME_KEY });
            // Back to where you came from (the post screen shows the "being
            // reviewed" duck), rather than a second copy of it here that the
            // back button would show again.
            router.back();
          }}
        />
      )}
    </Shell>
  );
}

/* ────────────────────────────── chrome ──────────────────────────────── */

function Shell({
  insets,
  onBack,
  children,
}: {
  insets: { top: number; bottom: number };
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.surface, paddingTop: insets.top }}>
      <View style={{ height: 44, justifyContent: "center", paddingHorizontal: gap.sm }}>
        <Tappable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
          <ChevronLeftIcon size={24} color={color.ink} />
        </Tappable>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gap.lg,
          paddingBottom: insets.bottom + gap.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  busy,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "primary" | "quiet";
}) {
  const primary = tone === "primary";
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        marginTop: gap.lg,
        height: 52,
        borderRadius: radius.primaryButton,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? color.green : color.control,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color={primary ? color.onGreen : color.ink} />
      ) : (
        <Text
          style={[
            textStyle(type.primaryButton),
            { color: primary ? color.onGreen : color.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Tappable>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={[
        textStyle(type.emptyBody),
        { color: color.inkSecondary, marginTop: gap.sm, lineHeight: 21 },
      ]}
    >
      {children}
    </Text>
  );
}

/* ────────────────────────────── branches ────────────────────────────── */

/**
 * The three end states as ONE centered duck screen, the same one the post
 * screen shows, so submitting and pressing back never shows the same news
 * twice in two different layouts.
 */
function DuckState({
  pose,
  title,
  body,
  cta,
}: {
  pose: "idCard" | "celebrate" | "worry";
  title: string;
  body: string;
  cta?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: "center", paddingTop: 40 }}>
      <ExpoImage source={MASCOT[pose]} contentFit="contain" style={{ width: 130, height: 190, marginBottom: 18 }} accessible={false} />
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink, textAlign: "center" }]}>{title}</Text>
      <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary, marginTop: gap.sm, lineHeight: 21, textAlign: "center" }]}>
        {body}
      </Text>
      <View style={v.openBox}>
        <Text style={v.openTitle}>Still open while you wait</Text>
        <Text style={v.openBody}>Browsing, searching, messaging, liking, commenting, and accepting a trade someone offers you.</Text>
      </View>
      {cta ? <View style={{ alignSelf: "stretch" }}><Button label={cta.label} onPress={cta.onPress} /></View> : null}
    </View>
  );
}

function Approved({ payload, onDone }: { payload: IdVerificationPayload; onDone: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 40 }}>
      <ExpoImage source={MASCOT.celebrate} contentFit="contain" style={{ width: 150, height: 190, marginBottom: 18 }} accessible={false} />
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink, textAlign: "center" }]}>You are verified</Text>
      <Text style={[textStyle(type.emptyBody), { color: color.inkSecondary, marginTop: gap.sm, lineHeight: 21, textAlign: "center" }]}>
        {payload.grandfathered
          ? "This account was already active when ID checks launched, so you were let through without one. You can post items and propose deferred agreements."
          : "Your ID was approved. You can post items and propose deferred agreements."}
      </Text>
      <View style={{ alignSelf: "stretch" }}><Button label="Done" onPress={onDone} /></View>
    </View>
  );
}

function Pending({ payload, onDone }: { payload: IdVerificationPayload; onDone: () => void }) {
  const sentAt = formatSubmittedAt(payload.latest?.submittedAt);
  return (
    <DuckState
      pose="idCard"
      title="Your ID is being reviewed"
      body={`Sent ${sentAt ?? "recently"}. A person looks at every one, usually within a day. As soon as it is approved you can post.`}
      cta={{ label: "Got it", onPress: onDone }}
    />
  );
}

function Exhausted({ payload }: { payload: IdVerificationPayload }) {
  return (
    <DuckState
      pose="worry"
      title="No attempts left"
      body={`${payload.latest?.rejectionFix ?? "Your last submission was not approved."} That was attempt ${payload.maxAttempts} of ${payload.maxAttempts}; to go further, email support and mention this account.`}
    />
  );
}

/* ────────────────────────────── the form ────────────────────────────── */

function SubmitForm({
  payload,
  onSubmitted,
}: {
  payload: IdVerificationPayload;
  onSubmitted: () => void;
}) {
  const [idType, setIdType] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [image, setImage] = useState<{ uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rejected = payload.status === "rejected";

  const submit = useMutation({
    mutationFn: () =>
      submitIdVerification({
        idType: idType!,
        idNumber: idNumber.trim(),
        imageUri: image!.uri,
      }),
    onSuccess: () => {
      setError(null);
      onSubmitted();
    },
    onError: (e) => {
      // The server's message is shown verbatim. It is the one that knows
      // whether this was a duplicate ID, a bad file or a spent budget, and
      // rewriting it here would mean maintaining a second copy of five
      // refusals that a client cannot compute.
      const message =
        e instanceof ApiError
          ? e.message
          : "We could not send that just now. Try again in a moment.";
      // Inline AND a popup: the inline line sits above the button and is easy
      // to miss after the keyboard closes; the popup cannot be missed.
      setError(message);
      showDialog("Your ID was not sent", message, [{ text: "Got it" }], { pose: "worry" });
    },
  });

  async function pick(from: "camera" | "library") {
    setError(null);
    const perm =
      from === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(
        from === "camera"
          ? "Baylo needs camera access to take a photo of your ID. Turn it on in Settings."
          : "Baylo needs photo access to attach an ID. Turn it on in Settings.",
      );
      return;
    }

    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, exif: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.85,
            exif: false,
          });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    // No size check on the original: submitIdVerification() shrinks it to a
    // readable JPEG before sending, so a full-size photo is fine.
    setImage({ uri: asset.uri });
  }

  const ready = !!idType && idNumber.trim().length >= payload.limits.minIdNumberLength && !!image;

  const done1 = !!idType;
  const done2 = idNumber.trim().length >= payload.limits.minIdNumberLength;

  return (
    <>
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
        {rejected ? "Try again" : "Verify your ID"}
      </Text>

      {rejected && payload.latest?.rejectionFix ? (
        <View style={v.warn}>
          {/* The server's sentence, verbatim: it names the one thing to fix. */}
          <Text style={[textStyle(type.emptyBody), { color: color.ink, lineHeight: 21 }]}>
            {payload.latest.rejectionFix}
          </Text>
        </View>
      ) : (
        <Text style={v.lead}>
          Needed to post items and propose deferred agreements. Browsing, messaging and accepting
          trades stay open either way.
        </Text>
      )}

      {/* ── 1. which ID ── a real sequence, so the steps are numbered. */}
      <Step n={1} done={done1} title="Which ID?" hint="Student IDs are not accepted." />
      <View style={v.typeGrid}>
        {payload.idTypes.map((t) => {
          const on = idType === t.value;
          return (
            <Tappable
              key={t.value}
              onPress={() => setIdType(t.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[v.type, on && v.typeOn]}
            >
              <View style={[v.radio, on && v.radioOn]}>{on ? <View style={v.radioDot} /> : null}</View>
              <Text style={[v.typeText, on && { color: color.forest }]} numberOfLines={1}>
                {t.label}
              </Text>
            </Tappable>
          );
        })}
      </View>

      {/* ── 2. number ── */}
      <Step n={2} done={done2} title="ID number" hint="As printed. Spaces and dashes don't matter." />
      <TextInput
        value={idNumber}
        onChangeText={setIdNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={payload.limits.maxIdNumberLength}
        placeholder="e.g. 1234-5678-9012"
        placeholderTextColor={color.inkStale}
        style={v.input}
      />

      {/* ── 3. photo ── the empty frame is ID-card shaped, so it says what
          goes in it before the hint is read. */}
      <Step n={3} done={!!image} title="Photo of the ID" hint="Flat, in good light, all four corners in frame." />
      {image ? (
        <View style={{ marginTop: gap.md }}>
          <Image source={{ uri: image.uri }} style={v.photo} resizeMode="cover" />
          <Tappable onPress={() => pick("camera")} style={v.retake}>
            <Text style={v.link}>Retake photo</Text>
          </Tappable>
        </View>
      ) : (
        <View style={v.frame}>
          <View style={v.frameCard}>
            <View style={v.frameFace} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[v.frameLine, { width: "80%" }]} />
              <View style={[v.frameLine, { width: "55%" }]} />
              <View style={[v.frameLine, { width: "65%" }]} />
            </View>
          </View>
          <View style={v.frameButtons}>
            <Tappable onPress={() => pick("camera")} style={v.frameBtn}>
              <Text style={[textStyle(type.primaryButton), { color: color.onGreen, fontSize: 15 }]}>Take a photo</Text>
            </Tappable>
            <Tappable onPress={() => pick("library")} style={[v.frameBtn, v.frameBtnQuiet]}>
              <Text style={[textStyle(type.primaryButton), { color: color.ink, fontSize: 15 }]}>From gallery</Text>
            </Tappable>
          </View>
        </View>
      )}

      {error && (
        <View style={v.warn}>
          <Text style={[textStyle(type.emptyBody), { color: color.urgent, lineHeight: 21 }]}>{error}</Text>
        </View>
      )}

      <Button
        label="Send for review"
        onPress={() => submit.mutate()}
        disabled={!ready}
        busy={submit.isPending}
      />

      {/* What happens to it, in two short facts rather than a paragraph. */}
      <View style={v.facts}>
        <Text style={v.fact}>Reviewed by a person, usually within a day. You get a notification.</Text>
        <Text style={v.fact}>
          The photo is deleted once reviewed; we keep only the result. {payload.attemptsRemaining} of {payload.maxAttempts} attempts left.
        </Text>
      </View>
    </>
  );
}

function Step({ n, done, title, hint }: { n: number; done: boolean; title: string; hint: string }) {
  return (
    <View style={v.step}>
      <View style={[v.stepNum, done && v.stepNumDone]}>
        <Text style={[v.stepNumText, done && { color: color.onGreen }]}>{done ? "✓" : n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[textStyle(type.sectionHeading), { color: color.ink }]}>{title}</Text>
        <Text style={v.hint}>{hint}</Text>
      </View>
    </View>
  );
}

const v = StyleSheet.create({
  lead: { ...textStyle(type.emptyBody), color: color.inkSecondary, marginTop: gap.sm, lineHeight: 21 },
  warn: { marginTop: gap.md, padding: gap.md, borderRadius: radius.card, backgroundColor: color.urgentWash, borderWidth: 1, borderColor: color.urgentLine },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: gap.xl },
  stepNum: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: color.controlLineStrong, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumDone: { backgroundColor: color.green, borderColor: color.green },
  stepNumText: { fontSize: 13, fontWeight: "700", color: color.inkSecondary },
  hint: { ...textStyle(type.emptyBody), color: color.inkSecondary, marginTop: 2, fontSize: 14 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: gap.md },
  type: { width: "48.6%", flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface },
  typeOn: { borderColor: color.green, backgroundColor: color.greenWash },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: color.controlLineStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: color.green },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.green },
  typeText: { flex: 1, fontSize: 14, fontWeight: "600", color: color.ink },
  input: { marginTop: gap.md, height: 52, borderRadius: 12, backgroundColor: color.searchSurface, borderWidth: 1, borderColor: color.controlLine, paddingHorizontal: gap.md, color: color.ink, fontSize: 16, letterSpacing: 0.5 },
  frame: { marginTop: gap.md, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.controlLineStrong, backgroundColor: color.searchSurface, gap: 14 },
  frameCard: { alignSelf: "center", width: "70%", aspectRatio: 1.586, borderRadius: 10, backgroundColor: color.control, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  frameFace: { width: "30%", aspectRatio: 0.8, borderRadius: 6, backgroundColor: color.controlLine },
  frameLine: { height: 7, borderRadius: 4, backgroundColor: color.controlLine },
  frameButtons: { flexDirection: "row", gap: 8 },
  frameBtn: { flex: 1, height: 46, borderRadius: radius.primaryButton, backgroundColor: color.green, alignItems: "center", justifyContent: "center" },
  frameBtnQuiet: { backgroundColor: color.control },
  photo: { width: "100%", aspectRatio: 1.586, borderRadius: radius.card, backgroundColor: color.control },
  retake: { alignSelf: "center", paddingVertical: 10 },
  link: { fontSize: 15, fontWeight: "600", color: color.forest },
  facts: { marginTop: gap.md, gap: 6 },
  openBox: { alignSelf: "stretch", marginTop: 20, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: color.greenWash, gap: 2 },
  openTitle: { fontSize: 13, fontWeight: "600", color: color.forest },
  openBody: { fontSize: 13, lineHeight: 18, color: color.inkSecondary },
  fact: { ...textStyle(type.emptyBody), fontSize: 13, lineHeight: 18, color: color.inkMuted, textAlign: "center" },
});
