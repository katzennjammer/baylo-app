import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../src/api/client";
import {
  fetchIdVerification,
  submitIdVerification,
  type IdVerificationPayload,
} from "../src/api/id-verification";
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

const MAX_BYTES = 10 * 1024 * 1024;

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
        <Pending payload={data} />
      ) : data.status === "exhausted" ? (
        <Exhausted payload={data} />
      ) : (
        <SubmitForm
          payload={data}
          onSubmitted={() => qc.invalidateQueries({ queryKey: ["id-verification"] })}
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

function Approved({ payload, onDone }: { payload: IdVerificationPayload; onDone: () => void }) {
  return (
    <>
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
        You are verified
      </Text>
      <Note>
        {payload.grandfathered
          ? "This account was already active when ID checks launched, so you were let through without one. You can post items and propose deferred agreements."
          : "Your ID was approved. You can post items and propose deferred agreements."}
      </Note>
      <Button label="Back" onPress={onDone} />
    </>
  );
}

function Pending({ payload }: { payload: IdVerificationPayload }) {
  const at = payload.latest?.submittedAt ? new Date(payload.latest.submittedAt) : null;
  return (
    <>
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
        Your ID is being reviewed
      </Text>
      <Note>
        Sent {at ? at.toLocaleString() : "recently"}. A person looks at every one, usually within
        a day.
      </Note>
      {/*
        The most useful thing this screen can say, and the reason it says it
        prominently: almost nothing is actually blocked. Somebody who reads
        "pending" and assumes the app is frozen for them closes it and does not
        come back.
      */}
      <Note>
        Nothing else is on hold. You can browse, search, message, like and comment as normal, and
        you can still accept a trade somebody offers you — only posting an item and proposing a
        deferred agreement wait for this.
      </Note>
    </>
  );
}

function Exhausted({ payload }: { payload: IdVerificationPayload }) {
  return (
    <>
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
        No attempts left
      </Text>
      <Note>
        {payload.latest?.rejectionFix ??
          "Your last submission was not approved."}
      </Note>
      <Note>
        That was attempt {payload.maxAttempts} of {payload.maxAttempts}. To go further you will
        need to talk to a person — email support and mention this account.
      </Note>
      <Note>
        Everything except posting and proposing deferred agreements still works normally.
      </Note>
    </>
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
  const [image, setImage] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rejected = payload.status === "rejected";

  const submit = useMutation({
    mutationFn: () =>
      submitIdVerification({
        idType: idType!,
        idNumber: idNumber.trim(),
        imageUri: image!.uri,
        mimeType: image!.mimeType,
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
      setError(
        e instanceof ApiError
          ? e.message
          : "We could not send that just now. Try again in a moment.",
      );
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

    // Checked here as a courtesy so a 10 MB photo fails in a second rather than
    // after a slow upload. The server checks it too, and the server's answer is
    // the one that counts.
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      setError("That photo is over 10 MB. Take a new one rather than sending a full-size scan.");
      return;
    }
    setImage({ uri: asset.uri, mimeType: asset.mimeType });
  }

  const ready = !!idType && idNumber.trim().length >= payload.limits.minIdNumberLength && !!image;

  return (
    <>
      <Text style={[textStyle(type.emptyHeadline), { color: color.ink }]}>
        {rejected ? "Try again" : "Verify your ID"}
      </Text>

      {rejected && payload.latest?.rejectionFix ? (
        <View
          style={{
            marginTop: gap.md,
            padding: gap.md,
            borderRadius: radius.card,
            backgroundColor: color.urgentWash,
            borderWidth: 1,
            borderColor: color.urgentLine,
          }}
        >
          {/* The server's sentence, verbatim. It names the specific thing to
              change — the whole point of a closed reason list is that the user
              is never left guessing which part to fix. */}
          <Text style={[textStyle(type.emptyBody), { color: color.ink, lineHeight: 21 }]}>
            {payload.latest.rejectionFix}
          </Text>
        </View>
      ) : (
        <Note>
          Posting an item and proposing a deferred agreement need a government ID. Everything else
          — browsing, searching, messaging, and accepting a trade someone offers you — stays open
          whether you do this or not.
        </Note>
      )}

      <Note>
        {payload.attemptsRemaining} of {payload.maxAttempts} attempts left. We keep the outcome
        and a one-way digest of the number; the photo is deleted the moment somebody reviews it.
      </Note>

      {/* ── ID type ── */}
      <Text style={[textStyle(type.sectionHeading), { color: color.ink, marginTop: gap.xl }]}>
        Which ID?
      </Text>
      <Note>Student IDs are not accepted.</Note>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gap.sm, marginTop: gap.md }}>
        {payload.idTypes.map((t) => {
          const on = idType === t.value;
          return (
            <Tappable
              key={t.value}
              onPress={() => setIdType(t.value)}
              style={{
                paddingHorizontal: gap.md,
                paddingVertical: gap.sm,
                borderRadius: radius.primaryButton,
                borderWidth: 1,
                borderColor: on ? color.green : color.controlLine,
                backgroundColor: on ? color.greenWash : color.control,
              }}
            >
              <Text
                style={[
                  textStyle(type.chip),
                  { color: on ? color.forest : color.inkSecondary },
                ]}
              >
                {t.label}
              </Text>
            </Tappable>
          );
        })}
      </View>

      {/* ── number ── */}
      <Text style={[textStyle(type.sectionHeading), { color: color.ink, marginTop: gap.xl }]}>
        The number on it
      </Text>
      <Note>Exactly as printed. Spaces and dashes do not matter.</Note>
      <TextInput
        value={idNumber}
        onChangeText={setIdNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={payload.limits.maxIdNumberLength}
        placeholder="e.g. 1234-5678-9012"
        placeholderTextColor={color.inkStale}
        style={{
          marginTop: gap.md,
          height: 52,
          borderRadius: radius.card,
          backgroundColor: color.control,
          borderWidth: 1,
          borderColor: color.controlLine,
          paddingHorizontal: gap.md,
          color: color.ink,
          fontSize: 16,
        }}
      />

      {/* ── photo ── */}
      <Text style={[textStyle(type.sectionHeading), { color: color.ink, marginTop: gap.xl }]}>
        A photo of it
      </Text>
      <Note>
        Flat, in good light, with all four corners in frame. We strip the location data your
        camera writes into the file.
      </Note>

      {image ? (
        <View style={{ marginTop: gap.md }}>
          <Image
            source={{ uri: image.uri }}
            style={{
              width: "100%",
              aspectRatio: 1.586, // ID-1, the card format every one of these uses.
              borderRadius: radius.card,
              backgroundColor: color.control,
            }}
            resizeMode="cover"
          />
          <Button label="Choose a different photo" tone="quiet" onPress={() => pick("camera")} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: gap.sm, marginTop: gap.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Take a photo" tone="quiet" onPress={() => pick("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Choose one" tone="quiet" onPress={() => pick("library")} />
          </View>
        </View>
      )}

      {error && (
        <View
          style={{
            marginTop: gap.lg,
            padding: gap.md,
            borderRadius: radius.card,
            backgroundColor: color.urgentWash,
            borderWidth: 1,
            borderColor: color.urgentLine,
          }}
        >
          <Text style={[textStyle(type.emptyBody), { color: color.urgent, lineHeight: 21 }]}>
            {error}
          </Text>
        </View>
      )}

      <Button
        label="Send for review"
        onPress={() => submit.mutate()}
        disabled={!ready}
        busy={submit.isPending}
      />

      <Note>
        A person reviews it, usually within a day. You will get a notification either way.
      </Note>
    </>
  );
}
