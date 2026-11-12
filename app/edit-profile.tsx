import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, legacyFailure, request } from "../src/api/client";
import { useProfileMe } from "../src/api/profile";
import { uploadPhoto } from "../src/api/post";
import { color, font } from "../src/theme/tokens";
import { showDialog } from "../src/components/dialog";
import { MascotEmptyState } from "../src/components/MascotEmptyState";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, refetch, isError } = useProfileMe();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fill the form ONCE, from the first profile that arrives. Re-seeding on
  // every refetch (focus, the 60 s stale timer) replaced what the person was
  // in the middle of typing with the saved values.
  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setName(data.user.name);
    setBio(data.user.bio ?? "");
    setLocation(data.user.location ?? "");
    setAvatar(data.user.avatar);
  }, [data]);

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog("Photo access needed", "Allow photo access to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.9,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const uploaded = await uploadPhoto(result.assets[0].uri);
      setAvatar(uploaded.url);
    } catch {
      showDialog(
        "Could not upload photo",
        "Check your connection and try again.",
        [{ text: "Got it" }],
        { pose: "worry" },
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    // Never save a form that was not filled from the profile: the empty bio
    // and city would be written over the real ones.
    if (!data || !name.trim() || saving) return;
    setSaving(true);
    try {
      const response = await request("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `avatar` only when there is one. The server takes a string or no key
        // at all, and `null` -- what an account without a photo holds -- was a
        // 400 that made every save fail for those accounts.
        // An empty string REMOVES the photo: the server stores it as null.
        body: JSON.stringify({ name, bio, location, ...(avatar ? { avatar } : data?.user.avatar ? { avatar: "" } : {}) }),
      });
      if (!response.ok) await legacyFailure(response, "Could not save profile");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", "me"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["browse"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      await refetch();
      goBack(router);
    } catch (e) {
      // A 4xx carries the server's own reason ("Name cannot be empty"); only a
      // transport failure or a 5xx is really about the connection.
      showDialog(
        "Could not save profile",
        e instanceof ApiError && e.status < 500 ? e.message : "Check your connection and try again.",
        [{ text: "Got it" }],
        { pose: "worry" },
      );
    } finally {
      setSaving(false);
    }
  }

  const disabled = !data || saving || uploadingAvatar || !name.trim();
  const idVerified = data?.idVerification.verified ?? false;

  return <View style={s.screen}>
    {/* Cancel and Save at the top, where they stay reachable with the keyboard up. */}
    <View style={[s.top, { paddingTop: insets.top, height: insets.top + 56 }]}>
      <Pressable onPress={() => goBack(router)} accessibilityRole="button" style={s.topButton}><Text style={s.cancelText}>Cancel</Text></Pressable>
      <Text style={s.title}>Edit profile</Text>
      <Pressable onPress={() => void save()} disabled={disabled} accessibilityRole="button" style={[s.topButton, { alignItems: "flex-end" }]}>
        <Text style={[s.saveText, disabled && s.disabled]}>{saving ? "Saving..." : "Save"}</Text>
      </Pressable>
    </View>
    {!data ? (
      isError ? (
        <View style={s.state}>
          <MascotEmptyState
            pose="worry"
            title="Could not load your profile"
            message="Nothing was changed. Check your connection and try again."
            action={{ label: "Try again", onPress: () => void refetch() }}
          />
        </View>
      ) : (
        <View style={s.state}><ActivityIndicator color={color.green} /></View>
      )
    ) : (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    {/* Photo and its action on one row. */}
    <View style={s.photoRow}>
      {avatar ? <Image source={{ uri: avatar }} contentFit="cover" style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initial}>{name.trim().charAt(0).toUpperCase() || "?"}</Text></View>}
      <Pressable onPress={() => void chooseAvatar()} style={s.photoButton} accessibilityRole="button" accessibilityLabel="Change profile picture" disabled={uploadingAvatar}>
        <Text style={s.photoButtonText}>{uploadingAvatar ? "Uploading..." : "Change photo"}</Text>
      </Pressable>
      {avatar && !uploadingAvatar ? (
        <Pressable onPress={() => setAvatar(null)} style={s.photoButton} accessibilityRole="button" accessibilityLabel="Remove profile picture">
          <Text style={[s.photoButtonText, { color: color.urgent }]}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
    <Field label="Name" value={name} onChangeText={setName} help="Shown on your listings, offers and chats." />
    <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={MAX_BIO} counter={`${bio.length} / ${MAX_BIO}`} />
    {/* Location: a field plus one-tap nearby cities. */}
    <Field label="City" value={location} onChangeText={setLocation} />
    <View style={s.cities}>
      {NEARBY_CITIES.map((city) => (
        <Pressable key={city} onPress={() => setLocation(city)} accessibilityRole="button" style={[s.city, location === city && s.cityOn]}>
          <Text style={[s.cityText, location === city && s.cityTextOn]}>{city}</Text>
        </Pressable>
      ))}
    </View>
    {/* Things people look for, reachable from here. */}
    <Pressable onPress={() => router.push("/verify-id")} disabled={idVerified} accessibilityRole="button" style={s.linkRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.linkTitle}>ID verification</Text>
        <Text style={s.linkSub}>{idVerified ? "Verified" : "Not verified. Needed before you can post."}</Text>
      </View>
      {!idVerified ? <Text style={s.linkAction}>Verify</Text> : null}
    </Pressable>
    <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" style={[s.linkRow, { borderTopWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.linkTitle}>Email and password</Text>
        <Text style={s.linkSub}>Change these in Settings</Text>
      </View>
      <Text style={s.linkAction}>Open</Text>
    </Pressable>
    {saving ? <ActivityIndicator color={color.green} style={s.spinner} /> : null}
    </ScrollView>
    )}
  </View>;
}

/** The server's own limit (baylo-api validation.ts MAX_BIO). */
const MAX_BIO = 1000;
const NEARBY_CITIES = ["Lapu-Lapu City", "Cebu City", "Mandaue City"];

function Field({ label, value, onChangeText, multiline = false, help, counter, maxLength }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; help?: string; counter?: string; maxLength?: number }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} textAlignVertical={multiline ? "top" : "center"} style={[s.input, multiline && s.multiline]} placeholder={label} placeholderTextColor={color.inkMuted} />
    {help || counter ? <View style={s.helpRow}><Text style={s.help}>{help ?? ""}</Text>{counter ? <Text style={s.help}>{counter}</Text> : null}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  scroll: { flex: 1 },
  /** Loading or failed: the duck (or the spinner) centred in the space below the bar. */
  state: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: color.divider },
  topButton: { minWidth: 72, minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 20, marginBottom: 24 },
  photoButton: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: color.controlLineStrong, justifyContent: "center" },
  photoButtonText: { color: color.ink, fontFamily: font.sansSemi, fontSize: 14 },
  helpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  help: { color: color.inkSecondary, fontFamily: font.sans, fontSize: 12 },
  cities: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -10, marginBottom: 24 },
  city: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: color.controlLine, backgroundColor: color.searchSurface, justifyContent: "center" },
  cityOn: { backgroundColor: color.ink, borderColor: color.ink },
  cityText: { color: color.ink, fontFamily: font.sans, fontSize: 13 },
  cityTextOn: { color: "#FFFFFF", fontFamily: font.sansSemi },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: color.divider },
  linkTitle: { color: color.ink, fontFamily: font.sansSemi, fontSize: 15 },
  linkSub: { color: color.inkSecondary, fontFamily: font.sans, fontSize: 13, marginTop: 2 },
  linkAction: { color: color.forest, fontFamily: font.sansSemi, fontSize: 14 },
  title: { flex: 1, textAlign: "center", color: color.ink, fontFamily: font.sansBold, fontSize: 17 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: color.green },
  initial: { color: color.onGreen, fontFamily: font.sansBold, fontSize: 30 },
  changePhoto: { marginTop: 8 },
  changePhotoText: { color: color.forest, fontFamily: font.sansSemi, fontSize: 14 },
  field: { marginBottom: 20 },
  label: { color: color.inkSecondary, fontFamily: font.sansSemi, fontSize: 12, marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.controlLine, borderRadius: 8, color: color.ink, fontFamily: font.sans, fontSize: 15, paddingHorizontal: 14, backgroundColor: color.control },
  multiline: { minHeight: 110, paddingTop: 14 },
  spinner: { marginTop: 8 },
  bottomActions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
  cancelButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.control },
  saveButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.green },
  cancelText: { color: color.ink, fontFamily: font.sans, fontSize: 15 },
  saveText: { color: color.forest, fontFamily: font.sansBold, fontSize: 15 },
  disabled: { opacity: 0.5 },
});