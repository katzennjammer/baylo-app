import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ApiError } from "../src/api/client";
import { orgLogoUrl, useUpdateOrganization } from "../src/api/organizations";
import { usePublicProfile } from "../src/api/profile";
import { uploadPhoto } from "../src/api/post";
import { StoreIcon } from "../src/components/icons";
import { showDialog } from "../src/components/dialog";
import { color, font } from "../src/theme/tokens";

/**
 * Edit shop — the MSME storefront's logo, banner and description. OWNER only;
 * the storefront shows the button to owners alone, and the server 404s anyone
 * else who calls PATCH /api/v1/organizations/[id].
 *
 * SAME UPLOAD PATH AS edit-profile's avatar: pick, `uploadPhoto()` to the
 * public /api/upload, then send the returned URL. A logo and a banner are
 * meant to be seen by everyone, which is exactly what that route is for — and
 * exactly why the business document never goes near it.
 *
 * The business name, category and DTI number are NOT editable here. They are
 * what the document review checked; see the note on the PATCH route.
 */

const MAX_DESCRIPTION = 500;

export default function EditOrgScreen() {
  const router = useRouter();
  const { id, userId } = useLocalSearchParams<{ id?: string; userId?: string }>();
  const { data } = usePublicProfile(userId);
  const update = useUpdateOrganization(id ?? "");

  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [loaded, setLoaded] = useState(false);

  const org = data?.user.org ?? null;

  useEffect(() => {
    if (!org || loaded) return;
    setLogo(org.logoUrl);
    setBanner(org.bannerUrl ?? null);
    setDescription(org.description ?? "");
    setLoaded(true);
  }, [org, loaded]);

  async function choose(kind: "logo" | "banner") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showDialog("Photo access needed", `Allow photo access to choose a ${kind}.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      // Cropped to the shape it is drawn at, so what the owner frames is what
      // shoppers see: a square logo, a 3:1 banner.
      allowsEditing: true,
      aspect: kind === "logo" ? [1, 1] : [3, 1],
      quality: 0.9,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(kind);
    try {
      const uploaded = await uploadPhoto(result.assets[0].uri);
      if (kind === "logo") setLogo(uploaded.url);
      else setBanner(uploaded.url);
    } catch {
      showDialog("Could not upload photo", "Check your connection and try again.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!id || update.isPending || uploading) return;
    try {
      await update.mutateAsync({ logoUrl: logo, bannerUrl: banner, description: description.trim() || null });
      router.back();
    } catch (err) {
      showDialog("Could not save shop", err instanceof ApiError ? err.message : "Check your connection and try again.");
    }
  }

  if (!id || !userId) {
    return <View style={[s.screen, s.center]}><Text style={s.muted}>This shop could not be opened.</Text></View>;
  }
  if (!loaded) {
    return <View style={[s.screen, s.center]}><ActivityIndicator color={color.green} /></View>;
  }

  const bannerUri = banner ? orgLogoUrl(banner) : null;
  const logoUri = orgLogoUrl(logo);
  const busy = update.isPending || uploading !== null;

  return <View style={s.screen}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.top}><Text style={s.title}>Edit shop</Text></View>

      <Text style={s.label}>Banner</Text>
      <Pressable onPress={() => void choose("banner")} disabled={busy} accessibilityRole="button" accessibilityLabel="Change shop banner" style={s.bannerButton}>
        {bannerUri
          ? <Image source={{ uri: bannerUri }} contentFit="cover" style={s.banner} />
          : <LinearGradient colors={[color.forest, color.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />}
        <View style={s.overlay}><Text style={s.overlayText}>{uploading === "banner" ? "Uploading..." : bannerUri ? "Change banner" : "Add banner"}</Text></View>
      </Pressable>
      {bannerUri ? <Pressable onPress={() => setBanner(null)} disabled={busy} accessibilityRole="button" style={s.remove}><Text style={s.removeText}>Remove banner</Text></Pressable> : null}

      <Text style={[s.label, { marginTop: 20 }]}>Logo</Text>
      <Pressable onPress={() => void choose("logo")} disabled={busy} accessibilityRole="button" accessibilityLabel="Change shop logo" style={s.logoButton}>
        {logoUri
          ? <Image source={{ uri: logoUri }} contentFit="cover" style={s.logo} />
          : <View style={[s.logo, s.logoFallback]}><StoreIcon size={30} stroke={1.6} color={color.forest} /></View>}
        <Text style={s.changeText}>{uploading === "logo" ? "Uploading..." : logoUri ? "Change logo" : "Add logo"}</Text>
      </Pressable>

      <View style={s.field}>
        <Text style={s.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={MAX_DESCRIPTION}
          textAlignVertical="top"
          style={[s.input, s.multiline]}
          placeholder="What does your shop offer? One or two lines."
          placeholderTextColor={color.inkMuted}
        />
        <Text style={s.counter}>{description.length}/{MAX_DESCRIPTION}</Text>
      </View>
    </ScrollView>
    <View style={s.bottomActions}>
      <Pressable onPress={() => router.back()} style={s.cancelButton} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable>
      <Pressable onPress={() => void save()} disabled={busy} style={[s.saveButton, busy && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{update.isPending ? "Saving..." : "Save"}</Text></Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  center: { alignItems: "center", justifyContent: "center" },
  muted: { color: color.inkMuted, fontFamily: font.sans, fontSize: 14 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  top: { height: 64, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.divider, marginBottom: 24 },
  title: { color: color.ink, fontFamily: font.sansBold, fontSize: 17 },
  label: { color: color.inkSecondary, fontFamily: font.sansSemi, fontSize: 12, marginBottom: 7 },
  bannerButton: { borderRadius: 10, overflow: "hidden" },
  banner: { width: "100%", aspectRatio: 3 },
  overlay: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  overlayText: { color: "#FFFFFF", fontFamily: font.sansSemi, fontSize: 13 },
  remove: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center" },
  removeText: { color: color.urgent, fontFamily: font.sansSemi, fontSize: 13 },
  logoButton: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 44 },
  logo: { width: 84, height: 84, borderRadius: 14 },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: color.greenWash },
  changeText: { color: color.forest, fontFamily: font.sansSemi, fontSize: 14 },
  field: { marginTop: 24 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.controlLine, borderRadius: 8, color: color.ink, fontFamily: font.sans, fontSize: 15, paddingHorizontal: 14, backgroundColor: color.control },
  multiline: { minHeight: 110, paddingTop: 14 },
  counter: { alignSelf: "flex-end", color: color.inkMuted, fontFamily: font.sans, fontSize: 11, marginTop: 4 },
  bottomActions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: color.divider, backgroundColor: color.surface },
  cancelButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.control },
  saveButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: color.green },
  cancelText: { color: color.ink, fontFamily: font.sansSemi, fontSize: 14 },
  saveText: { color: color.onGreen, fontFamily: font.sansSemi, fontSize: 14 },
  disabled: { opacity: 0.5 },
});
