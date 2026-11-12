import { request } from "./client";
import { showDialog } from "../components/dialog";

/**
 * Put an item you got in a trade (OWNED) back on the marketplace:
 * POST /api/items/:id/relist, after a confirm. Shared by the profile's Traded
 * tab and the item page (7 Nov 2026), which until then had no way to do it.
 */
export function confirmRelist(item: { id: string; title: string }, onDone: () => void): void {
  showDialog("Relist this item?", `"${item.title}" goes back on the marketplace with the value it has now.`, [
    { text: "Not now", style: "cancel" },
    {
      text: "Relist",
      onPress: () => {
        void request(`/api/items/${encodeURIComponent(item.id)}/relist`, { method: "POST" })
          .then(async (res) => {
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              showDialog("Could not relist that", body?.error ?? "Something went wrong. Please try again.", [{ text: "Got it" }], { pose: "worry" });
              return;
            }
            onDone();
          })
          .catch(() =>
            showDialog("Could not relist that", "Check your connection and try again.", [{ text: "Got it" }], { pose: "worry" }),
          );
      },
    },
  ]);
}
