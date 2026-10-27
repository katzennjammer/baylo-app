let activePartnerId: string | null = null;

export function setActiveConversationPartnerId(partnerId: string): void {
  activePartnerId = partnerId;
}

export function clearActiveConversationPartnerId(partnerId?: string): void {
  if (partnerId === undefined || activePartnerId === partnerId) activePartnerId = null;
}

export function getActiveConversationPartnerId(): string | null {
  return activePartnerId;
}
