import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiV1, currentSession, request } from "./client";
import { getApiBase } from "./config";
import { clearActingOrg, setActingOrgId } from "./org-context";

/**
 * Organisations / SMMEs: creating one, listing the ones you may act as, and
 * switching context.
 *
 * ── THE DOCUMENT GOES UP AS MULTIPART, NOT THROUGH /api/upload ──────────────
 *
 * Every listing photo in this app is uploaded to /api/upload first and arrives
 * at its endpoint as a URL. A business document must NOT take that path, and
 * the server's own note says why: /api/upload writes public assets, so a DTI
 * registration carrying somebody's home address would be world-readable at a
 * guessable URL for the whole time it sat in the review queue — and would stay
 * there if the applicant abandoned the form. It goes straight to the
 * organisations endpoint in the request body and is destroyed on decision.
 *
 * Which means this module uses the multipart path in ./client rather than the
 * ordinary JSON one. Same reason /api/v1/id-verification does.
 */

export const ORGANIZATIONS_KEY = ["organizations"] as const;

export type OrgMemberRole = "OWNER" | "STAFF";
export type OrgVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface ActingOrg {
  id: string;
  name: string;
  logoUrl: string | null;
  role: OrgMemberRole;
  verified: boolean;
}

export interface OrgInvitation {
  membershipId: string;
  invitedAt: string;
  organization: { id: string; name: string; logoUrl: string | null };
}

export interface BusinessCategoryOption {
  value: string;
  label: string;
}

export interface OrganizationsPayload {
  organizations: ActingOrg[];
  invitations: OrgInvitation[];
  businessCategories: BusinessCategoryOption[];
  limits: { maxNameLength: number; maxImageBytes: number };
}

/**
 * The organisations this person may act as, plus the vocabulary the creation
 * form needs.
 *
 * THE CATEGORY LIST COMES FROM THE SERVER and is not compiled in, unlike
 * CATEGORY_LABELS in ./post. That duplication is justified there because the
 * post wizard has to paint twenty chips before any request has happened; this
 * form has already made a request by the time it renders, so there is nothing
 * to gain from a second copy that can go stale against the enum.
 */
export function useOrganizations(enabled = true, accessToken?: string | null) {
  return useQuery({
    // The token is part of the key. During signup this hook runs with the
    // held-but-uninstalled token and from inside the app it runs with none, and
    // those are two different requests -- sharing a cache entry would serve one
    // context's answer to the other.
    queryKey: accessToken ? [...ORGANIZATIONS_KEY, "signup"] : ORGANIZATIONS_KEY,
    queryFn: () =>
      apiV1<OrganizationsPayload>("/api/v1/organizations", {
        // Only during signup, where `memory` is empty and the interceptor has
        // nothing to attach. See CreateOrganizationInput.accessToken.
        ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
      }),
    enabled,
    // Memberships change when somebody else acts — an owner removing you, an
    // invitation arriving. Short, because the context switcher reading a stale
    // list is how you end up offering an org the next request will refuse.
    staleTime: 30_000,
  });
}

export interface CreateOrganizationInput {
  name: string;
  businessCategory: string;
  /** The local URI of the photographed DTI/SEC registration or permit. */
  documentUri: string;
  /**
   * The access token to present, when there is no INSTALLED session to read.
   *
   * ── THE SIGNUP FLOW IS THE REASON THIS EXISTS ───────────────────────────
   *
   * During registration the app holds a real, valid session and deliberately
   * does NOT install it: the (auth) guard redirects the instant a session
   * exists, which would throw somebody into the app mid-signup. The register
   * screen's own note explains it, and `resendVerification()` already takes a
   * token for exactly the same reason.
   *
   * So this endpoint has to be callable with a token that `currentSession()`
   * cannot see. Omitted from inside the app, where a session IS installed and
   * the ordinary Bearer attachment applies.
   */
  accessToken?: string;
}

export interface CreatedOrganization {
  organizationId: string;
  name: string;
  verificationStatus: OrgVerificationStatus;
  verified: boolean;
  /** The server's own sentence about what PENDING means. Shown verbatim. */
  notice: string;
}

/**
 * Register an organisation. The caller becomes its first OWNER.
 *
 * The response is deliberately read for its `notice` rather than having the
 * client compose one. "Your organisation is live and can post and trade now;
 * the badge appears once we have checked your document" is a statement about
 * server behaviour, and a client that writes its own version of it is a client
 * that will still be saying it after the behaviour changes.
 */
export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<CreatedOrganization> {
  // Either an installed session, or the one the signup flow is holding.
  if (!input.accessToken && !currentSession()) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue");
  }

  const form = new FormData();
  form.append("name", input.name);
  form.append("businessCategory", input.businessCategory);
  form.append("file", {
    uri: input.documentUri,
    name: "business-document.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  // This header is what authenticates the SIGNUP call, and it works because
  // during signup there is nothing to conflict with it. toHeaderRecord()
  // spreads the caller's headers first and then attaches `memory`'s token, so
  // an installed session would overwrite this one -- but during signup
  // `memory` is deliberately empty, so this is the only Authorization header
  // there is. From inside the app `accessToken` is omitted and the ordinary
  // attachment applies. The two paths never overlap.
  const res = await request("/api/v1/organizations", {
    method: "POST",
    body: form,
    ...(input.accessToken
      ? { headers: { Authorization: `Bearer ${input.accessToken}` } }
      : {}),
  });
  const payload = (await res.json()) as {
    data: CreatedOrganization | null;
    error: { code: string; message: string } | null;
  };
  if (!res.ok || !payload.data) {
    throw new ApiError(
      res.status,
      payload.error?.code ?? "INTERNAL_ERROR",
      payload.error?.message ?? "We could not register that.",
    );
  }
  return payload.data;
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async (created) => {
      // Act as the new organisation straight away. The founder just told us
      // this is who they are here to be, and making them find a switcher to
      // say it a second time is the kind of step that gets a feature
      // abandoned between screens.
      await setActingOrgId(created.organizationId);
      await qc.invalidateQueries({ queryKey: ORGANIZATIONS_KEY });
    },
  });
}

export interface OrgMember {
  membershipId: string;
  role: OrgMemberRole;
  status: "PENDING" | "ACTIVE";
  invitedAt: string;
  joinedAt: string | null;
  user: { id: string; name: string; avatar: string | null };
}

export interface OrgMembersPayload {
  members: OrgMember[];
  staffCount: number;
  viewerRole: OrgMemberRole;
}

export function useOrgMembers(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => apiV1<OrgMembersPayload>(`/api/v1/organizations/${organizationId}/members`),
    enabled: !!organizationId,
  });
}

/** Invite somebody by the email they signed up with. OWNER only. */
export function useInviteMember(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role?: OrgMemberRole }) =>
      apiV1(`/api/v1/organizations/${organizationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["organization-members", organizationId] }),
  });
}

/** Accept an invitation, or leave. The invited person's own two verbs. */
export function useRespondToInvitation(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { membershipId: string; action: "accept" | "leave" }) =>
      apiV1(`/api/v1/organizations/${organizationId}/members/${input.membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: input.action }),
      }),
    onSuccess: async (_data, input) => {
      // Leaving the organisation you are acting as must drop the context in
      // the same breath. Otherwise every subsequent request carries a header
      // the server now refuses, and the app reads as broken rather than as
      // "you left".
      if (input.action === "leave") clearActingOrg();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ORGANIZATIONS_KEY }),
        qc.invalidateQueries({ queryKey: ["organization-members", organizationId] }),
      ]);
    },
  });
}

/**
 * Switch which identity this client posts and trades as.
 *
 * Nothing is validated here and nothing can be: the membership lives on the
 * server and is re-read on every request. This sets the header the next
 * request will carry, and a revoked membership comes back as a 403 from
 * whatever that request was. See ./org-context.
 */
export async function switchToOrganization(organizationId: string | null): Promise<void> {
  await setActingOrgId(organizationId);
}

/** The absolute URL for an org logo, mirroring how avatars are resolved. */
export function orgLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  return `${getApiBase().replace(/\/+$/, "")}${logoUrl}`;
}
