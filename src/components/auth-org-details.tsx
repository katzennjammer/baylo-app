import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Text, View } from "react-native";

import { ApiError } from "../api/client";
import {
  useCreateOrganization,
  useOrganizations,
  type BusinessCategoryOption,
} from "../api/organizations";
import { ApiUrlGear } from "./ApiUrlGear";
import { Tappable } from "./Tappable";
import { StoreIcon } from "./icons";
import {
  AuthScreen,
  BandRow,
  Banner,
  Body,
  Field,
  FooterPrompt,
  Headline,
  PickerField,
  PrimaryButton,
  Wordmark,
  bandHeight,
  gap,
  keyboardRule,
} from "./auth-sheet";
import { authText, authType, sheetColor } from "../theme/auth-sheet-tokens";

/**
 * Registering the organisation: name, business category, and the document.
 *
 * ── THE ACCOUNT ALREADY EXISTS BY THE TIME ANYONE SEES THIS ─────────────────
 *
 * This screen is reached after `registerAccount()` has succeeded, which is what
 * makes every failure here recoverable rather than destructive: a person who
 * abandons it, or whose upload fails, still has the account they just made. The
 * copy says so, because a form that looks like the last step of signup is one
 * people feel they cannot leave.
 *
 * It is also why "Do this later" is a real, prominent option rather than a
 * grudging link. The business document is a photograph of a piece of paper that
 * may well be in a drawer at the shop, and demanding it at midnight during
 * signup is how an organisation becomes an individual account instead.
 *
 * ── THE DOCUMENT GOES STRAIGHT UP, NOT THROUGH /api/upload ──────────────────
 *
 * `useCreateOrganization()` posts multipart to /api/v1/organizations and the
 * file never touches the public upload route — see the header of
 * src/api/organizations.ts. Nothing here holds the image anywhere but in this
 * component's state and in the request.
 *
 * ── PENDING IS NOT A WAITING ROOM ───────────────────────────────────────────
 *
 * The success copy comes from the server's own `notice` and says the
 * organisation is live and can trade now. That matters more than it reads: an
 * applicant who thinks they are blocked until a review lands will not post, and
 * the review can take a day. What PENDING withholds is the badge.
 */

const MAX_NAME = 120;

export function OrgDetailsStep({
  accessToken,
  onDone,
  onSkip,
}: {
  /**
   * The token the signup flow is holding but has NOT installed.
   *
   * Without it every call from this screen is unauthenticated: the register
   * flow keeps its session in state rather than adopting it, because the
   * (auth) guard redirects the moment one exists and would throw the person
   * into the app mid-signup. Same reason `resendVerification()` takes one.
   *
   * Null is tolerated rather than refused, so this component is still usable
   * from inside the app later, where a session IS installed.
   */
  accessToken: string | null;
  /** Called once the organisation exists. Continues to "check your email". */
  onDone: () => void;
  /** "Do this later" — continues as an ordinary account. Nothing is created. */
  onSkip: () => void;
}) {
  // The token goes to the list fetch as well as to the create. During signup
  // the interceptor has nothing to attach, so without it this 401s and the
  // category picker is permanently empty.
  const { data } = useOrganizations(true, accessToken);
  const create = useCreateOrganization();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<BusinessCategoryOption | null>(null);
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; category?: string; document?: string }>({});

  // apiV1() unwraps to { data, meta }, so the payload is one level in.
  const categories = data?.data.businessCategories ?? [];
  const busy = create.isPending;

  async function pickDocument() {
    setBanner(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // No crop step. A registration is a whole page and a cropper invites
      // somebody to trim it to the bit they think matters, which is how a
      // document arrives without the registration number on it.
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setDocumentUri(result.assets[0].uri);
    setErrors((e) => ({ ...e, document: undefined }));
  }

  async function submit() {
    if (busy) return;

    const trimmed = name.trim();
    const next: typeof errors = {};
    if (trimmed.length < 2) next.name = "Enter your business name.";
    else if (trimmed.length > MAX_NAME) next.name = `That name is too long (${MAX_NAME} max).`;
    if (!category) next.category = "Pick the closest one.";
    if (!documentUri) next.document = "Attach your registration or permit.";

    if (Object.values(next).some(Boolean)) {
      setErrors(next);
      return;
    }

    setErrors({});
    setBanner(null);

    try {
      await create.mutateAsync({
        name: trimmed,
        businessCategory: category!.value,
        documentUri: documentUri!,
        ...(accessToken ? { accessToken } : {}),
      });
      onDone();
    } catch (err) {
      // Nothing was lost: the account exists, and the form still holds
      // everything that was typed. The banner says the first half, because the
      // second is visible.
      setBanner(
        err instanceof ApiError
          ? err.message
          : "We could not register that just now. Your account is fine — try again in a moment.",
      );
    }
  }

  return (
    <AuthScreen
      scrim="createAccount"
      band={bandHeight.signIn}
      padTop={keyboardRule.sheetPadTopSignIn}
      bandContent={
        <BandRow trailing={<ApiUrlGear variant="band" />}>
          <Wordmark />
        </BandRow>
      }
    >
      <Headline variant="logIn">Tell us about the business</Headline>

      <View style={{ height: gap.headlineToBody }} />
      <Body>
        Your account is already created. This adds the shop identity — you can
        post and trade as soon as it is saved, and the verified badge appears
        once we have checked the document.
      </Body>

      <View style={{ height: gap.bodyToControl.signIn }} />

      <Field
        label="Business name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setErrors((e) => (e.name ? { ...e, name: undefined } : e));
        }}
        error={errors.name}
        maxLength={MAX_NAME}
        autoCapitalize="words"
        editable={!busy}
      />

      <View style={{ height: gap.betweenInputs }} />
      <PickerField
        label="Business category"
        value={category?.label ?? null}
        placeholder="Pick the closest one"
        error={errors.category}
        disabled={busy || categories.length === 0}
        onPress={() => setPickerOpen(true)}
      />

      <View style={{ height: gap.betweenInputs }} />
      <DocumentPicker
        uri={documentUri}
        error={errors.document}
        disabled={busy}
        onPress={() => void pickDocument()}
      />

      {banner ? (
        <View style={{ marginTop: gap.inputsToDeclaration }}>
          <Banner message={banner} />
        </View>
      ) : null}

      <View style={{ flexGrow: 1 }} />
      <View style={{ height: gap.declarationToPrimary }} />

      <PrimaryButton label="Save and continue" onPress={() => void submit()} busy={busy} disabled={busy} />

      <FooterPrompt
        prompt="Don't have the document to hand?"
        label="Do this later"
        onPress={onSkip}
        disabled={busy}
      />

      <CategorySheet
        open={pickerOpen}
        options={categories}
        selected={category}
        onSelect={(option) => {
          setCategory(option);
          setErrors((e) => (e.category ? { ...e, category: undefined } : e));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </AuthScreen>
  );
}

/**
 * The document field: a tappable well that becomes a thumbnail.
 *
 * Shows the photo once one is chosen, because the single most common failure
 * for this kind of upload is attaching the wrong picture — and the only way
 * anybody catches that is by seeing it before they send it.
 */
function DocumentPicker({
  uri,
  error,
  disabled,
  onPress,
}: {
  uri: string | null;
  error?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Tappable
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change business document" : "Attach business document"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: error ? sheetColor.errorInk : sheetColor.label,
          backgroundColor: sheetColor.inputFill,
        }}
        pressedStyle={{ opacity: 0.85 }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 8 }} resizeMode="cover" />
        ) : (
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sheetColor.outlineFill,
            }}
          >
            <StoreIcon size={24} stroke={1.6} color={sheetColor.label} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[authText(authType.inputValue), { color: sheetColor.ink }]}>
            {uri ? "Document attached" : "Attach your business document"}
          </Text>
          <View style={{ height: 3 }} />
          <Text style={[authText(authType.legal), { color: sheetColor.label }]}>
            DTI or SEC registration, or a barangay business permit. We delete it
            as soon as it has been checked.
          </Text>
        </View>
      </Tappable>
      {error ? (
        <View style={{ marginTop: 6 }}>
          <Text style={[authText(authType.legal), { color: sheetColor.errorInk }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The business-category list, served by the API rather than compiled in. */
function CategorySheet({
  open,
  options,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  options: BusinessCategoryOption[];
  selected: BusinessCategoryOption | null;
  onSelect: (option: BusinessCategoryOption) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,.45)",
        justifyContent: "flex-end",
      }}
    >
      <Tappable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1 }}
      >
        <View />
      </Tappable>
      <View
        style={{
          backgroundColor: sheetColor.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingVertical: 12,
          maxHeight: "70%",
        }}
      >
        {options.map((option) => (
          <Tappable
            key={option.value}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected?.value === option.value }}
            style={{ paddingVertical: 14, paddingHorizontal: 22 }}
            pressedStyle={{ opacity: 0.7 }}
          >
            <Text
              style={[
                authText(authType.inputValue),
                {
                  color:
                    selected?.value === option.value ? sheetColor.frame : sheetColor.ink,
                },
              ]}
            >
              {option.label}
            </Text>
          </Tappable>
        ))}
      </View>
    </View>
  );
}
