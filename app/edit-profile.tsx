import { useRouter } from "expo-router";

import { goBack } from "../src/lib/go-back";
import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, legacyFailure, request } from "../src/api/client";
import { useProfileMe } from "../src/api/profile";
import { uploadPhoto } from "../src/api/post";
import { color, font } from "../src/theme/tokens";
import { showDialog } from "../src/components/dialog";

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, refetch } = useProfileMe();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
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
      showDialog("Could not upload photo", "Check your connection and try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const response = await request("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `avatar` only when there is one. The server takes a string or no key
        // at all, and `null` -- what an account without a photo holds -- was a
        // 400 that made every save fail for those accounts.
        body: JSON.stringify({ name, bio, location, ...(avatar ? { avatar } : {}) }),
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
      );
    } finally {
      setSaving(false);
    }
  }

  return <View style={s.screen}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.top}><Text style={s.title}>Edit profile</Text></View>
    <Pressable onPress={() => void chooseAvatar()} style={s.avatarButton} accessibilityRole="button" accessibilityLabel="Change profile picture" disabled={uploadingAvatar}>
      {avatar ? <Image source={{ uri: avatar }} contentFit="cover" style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initial}>{name.trim().charAt(0).toUpperCase() || "?"}</Text></View>}
      <View style={s.changePhoto}><Text style={s.changePhotoText}>{uploadingAvatar ? "Uploading..." : "Change photo"}</Text></View>
    </Pressable>
    <Field label="Name" value={name} onChangeText={setName} />
    <Field label="Bio" value={bio} onChangeText={setBio} multiline />
    <Field label="Location" value={location} onChangeText={setLocation} />
    {saving ? <ActivityIndicator color={color.green} style={s.spinner} /> : null}
    </ScrollView>
    <View style={s.bottomActions}><Pressable onPress={() => goBack(router)} style={s.cancelButton} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => void save()} disabled={saving || uploadingAvatar || !name.trim()} style={[s.saveButton, (saving || uploadingAvatar || !name.trim()) && s.disabled]} accessibilityRole="button"><Text style={s.saveText}>{saving ? "Saving..." : "Save"}</Text></Pressable></View>
  </View>;
}

function Field({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} style={[s.input, multiline && s.multiline]} placeholder={label} placeholderTextColor={color.inkMuted} /></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  top: { height: 64, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: color.divider, marginBottom: 24 },
  title: { color: color.ink, fontFamily: font.sansBold, fontSize: 17 },
  avatarButton: { alignSelf: "center", alignItems: "center", marginBottom: 28, minHeight: 44 },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarFallback: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: color.green },
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
  cancelText: { color: color.ink, fontFamily: font.sansSemi, fontSize: 14 },
  saveText: { color: color.onGreen, fontFamily: font.sansSemi, fontSize: 14 },
  disabled: { opacity: 0.5 },
});