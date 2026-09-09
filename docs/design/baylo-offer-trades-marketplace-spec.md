# Baylo — implementation spec

## Offer flow · Trades · Marketplace out-of-reach

Same depth and conventions as `baylo-feed-spec` / `baylo-auth-spec` / `baylo-post-item-spec`. Base device 390 × 844 @3x. Every px value below is CSS px at 390 width unless a 360 note says otherwise.

**The offer flow is Direction A (the bar) — chosen and closed.** One scrolling screen, the gap as a single horizontal track. Everything in this document describes A and is the spec of record. Direction B (the two columns) was the road not taken; §12 records what it was and why it lost, for the archive only. Nothing in §12 is to be built, and the decision is not open.

---

## 1. Colour

Every hex used across these three areas. No colour appears here that isn't in the feed/auth/post system.

### 1.1 Surfaces

| Token | Hex | Use |
|---|---|---|
| `surface/paper` | `#FAFAF7` | All screen backgrounds, sheets, bottom bars |
| `surface/desk` | `#EFEEE8` | Canvas behind device frames only; never in-app |
| `surface/sunk` | `#F5F4EE` | Disabled row fill (unverified DPA row), collapsed History row |
| `surface/quiet` | `#EDEBE3` | Keyboard suggestion chips, drag handle track, inert fills |
| `surface/tint-green` | `#F2F8F3` | Selected settlement row, selected hub, selected date preset |
| `surface/track-green` | `#EAF6EC` | Unfilled portion of the gap track, Leaves meter track |
| `surface/track-warm` | `#F6EBE6` | Promise meter track (7c), DPA progress track |
| `surface/photo-placeholder` | `#E6E4DA` | Their-side block, avatar circles, value blocks with no photo |
| `surface/scrim` | `#14140F` @ 42% | Behind any bottom sheet (item picker, one-time prompt) |

### 1.2 Ink

| Token | Hex | Use |
|---|---|---|
| `ink/primary` | `#14140F` | Screen headings, item titles, values, button labels on outline buttons, body copy that carries a fact |
| `ink/secondary` | `#5C5B52` | Supporting sentences, row subtitles, mono metadata, greyed tile titles |
| `ink/tertiary` | `#8C8A7E` | Section labels, counters, footnotes, out-of-reach mono values, placeholder text |
| `ink/disabled` | `#A8A69A` | Chevrons, disabled row icons |
| `ink/on-green` | `#0B2A15` | Label on `#3DBE5A` primary buttons — never `#FAFAF7`, contrast is the point |
| `ink/on-dark` | `#FAFAF7` | Label on `#14140F` chips |

Contrast: `ink/secondary` on paper 6.9:1, `ink/tertiary` on paper 4.6:1 (never below 15px), `ink/on-green` on `#3DBE5A` 8.2:1.

### 1.3 Greens

| Token | Hex | Use |
|---|---|---|
| `green/action` | `#3DBE5A` | Primary button fill, your-side fill of the gap track, caret, Leaves meter fill |
| `green/deep` | `#1B4D2B` | Selected-row border, selected radio fill, link/inline action text, overflow segment of the track (offering more), "you are here" mono |
| `green/soft` | `#B7D9BE` | Only in out-of-reach: the margin between your highest item and the threshold |
| `green/dark-ink` | `#0B2A15` | See `ink/on-green` |

### 1.4 Warm accent (terracotta)

`#C56A4B` — one hex, four jobs, never as a large fill:

1. The short segment of the gap track.
2. Promise blocks and DPA amounts (1.5px outline, no fill).
3. Failure panels (1.5px outline — per the post-flow rule: **outline warns, fill fails**; a filled `#C56A4B` panel is reserved for hard failures, which do not occur in these three areas).
4. Mono values that are a debt or a default (`Past defaults`, `1, settled late`).

Never used for out-of-reach. Out-of-reach is not an error.

### 1.5 Borders and dividers

| Token | Hex | Width | Use |
|---|---|---|---|
| `line/hairline` | `#EDEBE3` | 1px | Every section divider, table row rule, header underline |
| `line/rule` | `#E2E0D6` | 1px | Unselected row/tile borders, column centre rule, drag handle |
| `line/strong` | `#D8D6CC` | 1px | Secondary button border, unselected radio ring, dashed rules |
| `line/selected` | `#1B4D2B` | 1.5px | Selected settlement row, selected hub, selected date |
| `line/promise` | `#C56A4B` | 1.5px | Promise block, DPA notice, send-failed panel |
| `line/field` | `#14140F` | 1.5px | Amount field underline, at rest |
| `line/field-active` | `#1B4D2B` | 1.5px | Amount field underline, focused |

### 1.6 Chips, badges, tiers

| Element | Fill | Border | Text |
|---|---|---|---|
| Active category chip | `#14140F` | — | `#FAFAF7` |
| Inactive category chip | none | `#E2E0D6` 1px | `#14140F` |
| Stack-edit chip (7b/7c) | none | `#E2E0D6` 1px | `#14140F` |
| Keyboard suggestion | `#EDEBE3` | — | `#5C5B52` |
| Trust tier | none | — | `#5C5B52` mono, inline after the name |

Tiers are **typographic, not coloured** — `New Trader`, `Rising`, `Trusted`, `Top Trader` render as `#5C5B52` mono in the metadata line. The one exception is `#1B4D2B` for `you are here` in the ceiling table.

### 1.7 DPA states

| State | Marker | Colour |
|---|---|---|
| Pending acceptance | 1.5px outline block/row | `#C56A4B` outline, `#14140F` text |
| Active | Solid left rule 3px + mono amount | `#C56A4B` rule, `#14140F` amount |
| Partially paid | Progress meter, track `#F6EBE6`, fill `#C56A4B` | Paid figure `#14140F`, remainder `#5C5B52` |
| Deadline near | Same as active + urgency mono (see 1.8) | — |
| Defaulted | Row fill `#F5F4EE`, 1.5px `#C56A4B` outline, mono label `Defaulted` | `#C56A4B` |
| Fulfilled | Hairline row, mono `Settled 4 Oct` | `#5C5B52`, no accent |

Fulfilled agreements lose all accent colour. Nothing congratulates.

### 1.8 Deadline urgency scale

Days remaining drives the **mono colour only** — never a fill, never an icon change.

| Days | Colour | String |
|---|---|---|
| 15+ | `#5C5B52` | `due 22 Sep · 16 days` |
| 8–14 | `#5C5B52` | `due 22 Sep · 11 days` |
| 4–7 | `#14140F` | `due 22 Sep · 6 days` |
| 1–3 | `#C56A4B` | `due 22 Sep · 2 days` |
| Today | `#C56A4B` | `due today` |
| Overdue | `#C56A4B` | `overdue by 3 days` |

### 1.9 Out-of-reach treatment

| Property | Value |
|---|---|
| Tile photo | `filter: grayscale(1); opacity: .62` |
| Tile title | `#5C5B52` (from `#14140F`) |
| Tile value unit | `Leaves` stays spelled out, per the locked feed tile |
| Tile value line | `#8C8A7E` (from `#1B4D2B`) — family, weight and size unchanged from the feed convention: Public Sans 600 12px |
| Tile border/radius/size | unchanged |
| Detail photo | **full colour, unmodified** — the grey is a grid-level signal only |
| Threshold bar | your item `#3DBE5A`, margin `#B7D9BE`, distance `#C56A4B` |

### 1.10 Error and success

| Case | Treatment |
|---|---|
| Send failed | Panel, 1.5px `#C56A4B` outline, paper fill, triangle icon `#C56A4B` |
| Network error (Trades) | Same panel, inline in the list position |
| Wrong confirmation code | Field underline `#C56A4B`, mono counter `#C56A4B`, no shake, no toast |
| Success (offer sent, code matched) | No colour event. The screen changes to the next state and a mono line states what happened. There is no success green flash and no confetti anywhere in Baylo. |

---

## 2. Type

Families: **Bricolage Grotesque** (screen headings, gap figures), **Public Sans** (everything else), **JetBrains Mono** (values, labels, metadata, codes).

| Role | Family | Weight | Size | Line height | Tracking |
|---|---|---|---|---|---|
| Screen heading | Bricolage | 700 | 25px | 30px | −0.25px |
| Sheet heading | Bricolage | 700 | 21px | 25px | 0 |
| Detail title | Bricolage | 700 | 23px | 28px | −0.23px |
| Gap figure (A) | Bricolage | 700 | 44px | 40px | −0.88px |
| Gap word (`Even`, `Level`) | Bricolage | 700 | 40px | 36px | −0.80px |
| Nav title | Public Sans | 600 | 15px | 15px | 0 |
| Section label | JetBrains Mono | 500 | 11px | 11px | +1.32px, uppercase |
| Item title (row) | Public Sans | 600 | 15px | 19px | 0 |
| Item title (tile) | Public Sans | 600 | 14px | 18px | 0 |
| Tile value line | Public Sans | 600 | 12px | 12px | 0 |
| Row subtitle | Public Sans | 400 | 12px | 16px | 0 |
| Body copy | Public Sans | 400 | 15px | 23px | 0 |
| Body copy (dense) | Public Sans | 400 | 14px | 21px | 0 |
| Leaves value (row) | JetBrains Mono | 400 | 12px | 12px | 0 |
| Leaves value (detail) | JetBrains Mono | 500 | 20px | 20px | 0 |
| Leaves value (their column) | JetBrains Mono | 500 | 22px | 22px | 0 |
| Amount field | JetBrains Mono | 500 | 40px | 40px | 0 |
| Amount field (B) | JetBrains Mono | 500 | 36px | 36px | 0 |
| Table figure | JetBrains Mono | 400 | 15px | 20px | 0 |
| Trust tier | JetBrains Mono | 400 | 12px | 12px | 0 |
| Deadline text | JetBrains Mono | 400 | 11px | 11px | 0 |
| Code digits | JetBrains Mono | 500 | 40px | 40px | +4px |
| Code entry digits | JetBrains Mono | 500 | 34px | 34px | +3px |
| Button label (primary) | Public Sans | 700 | 16px | 16px | 0 |
| Button label (secondary) | Public Sans | 600 | 15px | 15px | 0 |
| Button label (tertiary) | Public Sans | 600 | 14px | 14px | 0 |
| Chip label | Public Sans | 600 | 13px | 13px | 0 |
| Helper text | Public Sans | 400 | 12px | 18px | 0 |
| Footnote (mono) | JetBrains Mono | 400 | 11px | 16px | 0 |
| Error text | Public Sans | 400 | 13px | 20px | 0 |
| Error heading | Public Sans | 600 | 15px | 20px | 0 |

Body copy sets `text-wrap: pretty`. Nothing below 11px, and 11px is mono metadata only.

---

## 3. Spacing

### 3.1 Global

- Screen side padding **16px**. Nav bar side padding 12px (44px tap targets absorb the difference).
- Status bar 44px. Nav bar 44px. Bottom bar top padding 12px, bottom padding 26px.
- Section divider: full-bleed 1px `#EDEBE3`, no side inset.
- Section internal padding: 18px top / 16px sides / 22px bottom, unless stated.
- Label-to-content gap 10px. Row-to-row gap 10px. Paragraph-to-control gap 14px.

### 3.2 Offer screen (6d, small gap) — running y

| y | Element |
|---|---|
| 0 | Status bar |
| 44 | Nav bar (back 44×44, title) |
| 88 | Listing header block, padding-top 6 |
| 94 | 56px photo + title/mono stack |
| 164 | Hairline |
| 165 | *You're offering* section, padding-top 18 |
| 183 | Section label (11px) |
| 204 | Item row, 56px |
| 274 | Hairline |
| 275 | *The gap* section, padding-top 20 |
| 295 | Section label |
| 320 | Gap figure baseline block (44px) |
| 378 | Track, 14px |
| 399 | Track legend, 11px |
| 424 | Explanation copy, 15/23 |
| 470 | Hairline |
| 471 | *Settle the 40* section, padding-top 18 |
| 489 | Section label |
| 510 | Row 1, 60px (selected) |
| 580 | Row 2, 60px |
| 650 | Row 3, 60px |
| 732 | Bottom bar hairline |
| 745 | Primary button, 52px |
| 805 | Footnote, 12px |
| 818 | Safe area |

Sections scroll; the bottom bar is fixed. Content above the bar is scrollable to 732.

### 3.3 Offer screen variants

- **Even (6b):** the *Settle* section is absent, not disabled. Meet-up section takes its place at y 471. Gap section ends with one sentence, no rows.
- **Offering more (6c):** *The difference* section replaces *Settle*, two 56px rows.
- **Large gap (6e):** *Settle* holds four 60px rows; total content height 862, scrolls by 130.
- **Very large gap (6f):** *What works instead* holds two 60px rows plus a 12px footnote; the primary button is replaced by a 52px outline button.

### 3.4 DPA proposal (6g)

Intro 10/16/20 · hairline · amount section 20/16/20 (label 11, field 50 incl. 10 padding + 1.5 underline, constraint row 12) · hairline · deadline section 20/16/20 (label, 3 × 56px presets with 8px gaps, 52px date row at 12px gap) · hairline · record section 20/16/20 (label, three 15px rows at 10px vertical padding, hairline between) · bottom bar: consequence copy 12/18 then 9px gap then 52px button.

### 3.5 Trades screen — running y (populated)

| y | Element |
|---|---|
| 0 | Status bar |
| 44 | Nav bar — `Trades` heading 22px Bricolage, side padding 16 |
| 88 | *Needs you today* block: 14px top padding |
| 102 | Block label (mono 11, `#8C8A7E`) |
| 123 | Card 1, 88px (code-ready trade) |
| 219 | Card 2, 88px (DPA deadline near) |
| 315 | Card 3, 76px (incoming offer) |
| 399 | Hairline |
| 400 | *Waiting* section, 18px top padding |
| 418 | Section label |
| 439 | Row 1, 72px |
| 511 | Hairline (row rule, 16px inset left of text only — full bleed) |
| 512 | Row 2, 72px |
| 584 | Row 3, 72px |
| 672 | Hairline |
| 673 | History row, 60px, `#F5F4EE` fill, chevron right |
| 733 | Hairline |
| 734+ | Empty paper to the tab bar |
| 761 | Tab bar 83px (existing component, unchanged) |

Cards in *Needs you today* sit 8px apart; Waiting rows are divided by hairlines with no gap.

### 3.6 Marketplace additions

- Greyed tile: identical geometry to your existing tile (164px photo, 8px gap, title, 3px gap, mono line). No extra padding.
- Detail insert (*Where you stand*): section padding 18/16/18, internal gaps — label→copy 8, copy→bar 14, bar→legend 7, legend→routes 14, route rows 10 apart at 64px each, routes→footnote 14.
- One-time prompt sheet: radius 20px top, padding 20/20/26, gaps — handle→heading 16, heading→body 9, body→example pair 16, pair→numbered list 16, list items 11 apart, list→button 16. Sheet height 512px at 390 width.

### 3.7 Radii

| Element | Radius |
|---|---|
| Device frame (mock only) | 34px |
| Bottom sheet | 20px top |
| Primary/secondary button | 10px |
| Settlement row, hub row, date row, route row | 10px |
| Chip | 8px |
| Item thumbnail 52–60px | 8px |
| Tile photo, detail insert blocks | 10px |
| Gap track, meters | 3px |
| Column value block (B) | 4px |
| Radio ring | 50% (10px radius on 20px) |
| Avatar | 50% |
| Code digit cell | 8px |

---

## 4. Component sizes

| Component | Size |
|---|---|
| Gap track (A) | 358 × 14, radius 3, segments by flex ratio, min visible segment 4px |
| Gap figure block | 44px type on 40px line, mono suffix 14px baseline-aligned −5 |
| Track legend | two 11px mono labels, space-between |
| Column pair (B) | 300px tall, two flex:1 columns, 1px centre rule, 16px inner padding each side |
| Column block min height | 15px (below that, label moves outside the block) |
| Item picker row (sheet) | 60px photo, 12px gap, text stack, 22px radio; row height 84 incl. 12/12 padding |
| Item row (in-flow) | 56px photo, 12px gap, stack, `Change` link with 14px left / 14px vertical padding |
| Settlement row | min-height 60, 14px side padding, 20px radio, 12px gap |
| Route row (very large gap, out-of-reach) | min-height 60 / 64, 19px icon, 12px gaps, 18px chevron |
| DPA amount field | full width, 40px mono, 10px bottom padding, 1.5px underline; caret 2 × 34 `#3DBE5A` |
| Date preset | flex 1, min-height 56, 8px gaps between three |
| Date row | min-height 52, 18px icon, 18px chevron |
| Record table row | 15px type, 10–11px vertical padding, hairline between |
| Confirmation code display | 4 digits, 40px mono, +4px tracking, 14px gap; each digit in a 56 × 72 cell, radius 8, `#EDEBE3` fill |
| Confirmation code entry | 4 cells 68 × 84, radius 8, 1px `#E2E0D6`, active cell 1.5px `#1B4D2B`; 34px mono |
| Trade card (*Needs you today*) | 88px, 48px thumb, 12px gap, three text lines, 10px radius, 1px `#E2E0D6` |
| Trade row (*Waiting*) | 72px, 44px thumb, 12px gap, two lines + right-aligned mono |
| Section header | mono 11 label, 21px below label to first item |
| *Needs you today* block | label + n cards, 8px card gap, no container fill or border |
| History row | 60px, `#F5F4EE`, mono count right, 18px chevron |
| Greyed tile | as existing tile; photo 164px tall, full column width |
| Threshold bar (out-of-reach) | 358 × 14, three segments, radius 3 |
| Button primary | 52px, radius 10, `#3DBE5A` |
| Button secondary | 52px, radius 10, 1px `#D8D6CC` |
| Button tertiary (text) | 44px tap height, no border |
| Split buttons (accept/decline) | two flex:1 at 52px, 8px gap |
| Icon, nav/back | 22px, stroke 1.9 |
| Icon, inline row | 18–19px, stroke 1.7 |
| Icon, warning triangle | 19px, stroke 1.8 |
| Icon, radio check | 12–13px, stroke 2.6–2.8 |
| Tap target minimum | 44 × 44 everywhere |

---

## 5. Offer flow states

### 5.1 The five gap situations

| Situation | Rule | Track | Figure | Settlement section | Primary button |
|---|---|---|---|---|---|
| Even | within ±10% | single `#3DBE5A` fill at yours/theirs ratio | `Even` + mono `40 apart` | absent | `Send offer` |
| Offering more | yours > theirs +10% | `#3DBE5A` to theirs, `#1B4D2B` beyond, 2px gap | `280 over` in `#1B4D2B` | *The difference*, 2 rows | `Send offer` |
| Small gap | short ≤ balance, short ≤ 25% of theirs | `#3DBE5A` + `#C56A4B` | `40` + `Leaves short` | 3 rows, Leaves preselected | `Send offer with 40 Leaves` |
| Large gap | short ≤ balance + promise ceiling | `#3DBE5A` + `#C56A4B` | `180` + `Leaves short` | 4 rows, split preselected | `Set up the agreement` |
| Very large gap | short > balance + ceiling | true ratio, min 4px green | `1,900` + `Leaves short` | *What works instead*, 2 routes | `Send as-is anyway` (secondary style) |

The track never lies about ratio, and the treatment never changes with magnitude — only how much terracotta is visible. There is no disabled send in any situation.

### 5.2 Blocking and edge states

| State | Behaviour |
|---|---|
| **No items to offer** | Listing header retained. Heading + body + two numbered steps. Primary `Post your first item`, tertiary `Save this listing for later`. No illustration. |
| **Not ID-verified** | Only the DPA row changes: fill `#F5F4EE`, 1px dashed `#D8D6CC`, lock icon `#A8A69A`, both lines `#8C8A7E`. A 48px `Verify your ID` outline button sits below the rows, then a 12px footnote. Leaves and send-as-is stay live. |
| **Tier too low** | Full screen replacing the DPA proposal: heading with the ceiling number, ceiling table (4 rows, `you are here` mono `#1B4D2B`), then *From here* with two rows. Primary sends the largest legal combination. |
| **Pending offer exists** | Status, not error. Heading, sent-time sentence, *What you sent* summary, meetup row. Secondary `Withdraw and offer again`, tertiary `Leave it as it is`. |
| **Sending** | Content and nav at 45% opacity, back control removed. Footer button becomes a 52px `#EAF6EC` track with a `#3DBE5A` fill at 62% and label `Sending`; footnote `Holding 40 Leaves`. No spinner. |
| **Send failed** | 1.5px `#C56A4B` outline panel above the footer: heading + body naming what was preserved. Primary `Try sending again`, tertiary `Keep it and send later`. Leaves are released before this renders. |
| **Loading (offer screen)** | Listing header renders from cached feed data immediately. Gap section shows the track at `#EAF6EC` full width with the figure replaced by a 44 × 40 `#EDEBE3` block; settlement rows render as three 60px `#F5F4EE` rows. No skeleton shimmer on text. |

### 5.3 DPA lifecycle

| State | Screen | Copy anchor |
|---|---|---|
| Pending acceptance | Owner's acceptance view (6j) and proposer's Trades row | `Waiting for Marco · promise of 100` |
| Active | Trades *Waiting* row + trade detail | `100 promised · due 6 Oct` |
| Partially paid | Meter, track `#F6EBE6`, fill `#C56A4B` | `40 of 100 settled` |
| Deadline near (≤7 days) | Card promoted into *Needs you today* | `due 6 Oct · 4 days` in `#14140F`, ≤3 days `#C56A4B` |
| Defaulted | Row fill `#F5F4EE`, 1.5px `#C56A4B` outline | `Defaulted 7 Oct · 100 still owed` |
| Fulfilled | Hairline row in History, no accent | `Settled 4 Oct` |

---

## 6. Trades screen

**Organisation: one prioritised list, no tabs.** Tabs would put the code-at-the-car-park case behind a tap.

Order: *Needs you today* → *Waiting* → *History* (collapsed to a single row).

*Needs you today* admits, in this order: (1) trades where a confirmation code is live, (2) DPAs within 7 days of deadline or overdue, (3) incoming offers awaiting your reply. If it's empty the whole block — label included — is absent, and *Waiting* moves to y 88.

| State | Treatment |
|---|---|
| **Empty (no trades ever)** | Heading `No trades yet`, body, primary `Browse the marketplace`. No illustration. |
| **Empty (all settled)** | *Needs you today* and *Waiting* both absent; History row alone at y 88 with mono `14 trades`, plus a 15px line above it: `Nothing needs you right now.` |
| **Loading** | Section labels render immediately. Cards render as 88px `#F5F4EE` blocks, Waiting rows as 72px blocks with a 44px `#EDEBE3` square. Labels never skeleton. |
| **Network error** | 1.5px `#C56A4B` outline panel in the list position, heading `Can't load your trades`, body naming that nothing was lost, secondary `Try again`. Cached rows, if any, render below the panel under a mono label `Last loaded 14:20`. |

### 6.1 Confirmation codes

Four digits, generated per side at meet-up, entered by the other person.

| State | Display |
|---|---|
| **Waiting for them** | Your 4 digits at 40px mono in `#EDEBE3` cells + mono line `Show this to Marco`. Below: entry cells, empty, 1px `#E2E0D6`. |
| **They're waiting for you** | Entry cells first, active cell 1.5px `#1B4D2B`. Your code drops to a 15px line: `Your code is 4182`. |
| **Both submitted** | Both blocks collapse to a hairline row `Codes matched 15:42` and the trade moves to History. No success colour. |
| **Wrong code** | Cells keep their digits, underline `#C56A4B`, mono counter `#C56A4B`: `Not a match · 2 tries left`. After 3, the cells clear and a 52px `Ask Marco to read it again` outline button appears. No lockout. |

---

## 7. Marketplace out-of-reach

### 7.1 Threshold

```
reach = max(highest_available_item_value × 1.5, 150)
out_of_reach = listing_value > reach
```

Available means posted, not promised to another trade. Recomputed on post, trade completion, and revaluation. Never on scroll.

Example user: highest item 760 → reach 1,140. A 2,000 listing is 860 above; a 1,450 listing is 310 above.

### 7.2 Tile

Only three properties change (§1.9). Position in the existing sort is unchanged — sorting out-of-reach items last is a soft form of hiding. Tap behaviour identical.

### 7.3 Detail insert

Inserted between the value row and *Description*. Photo is **full colour** — the grey belongs to the grid, not the item.

Order: label `Where you stand` → one paragraph naming your highest item, the reach figure, and the distance → threshold bar (`#3DBE5A` your item / `#B7D9BE` margin / `#C56A4B` distance) → legend → two route rows → footnote. Both routes are rows, not buttons; the `Offer a trade` button in the bottom bar stays green and live.

### 7.4 One-time prompt

Bottom sheet over the grid, scrim `#14140F` @42%. Triggered on the first marketplace entry whose visible grid contains at least one out-of-reach tile. Once per account, flag `seen_reach_explainer`. Dismissed only by `Got it` — no X, not dismissible by scrim tap, so it can't be missed by accident. Never shown again, including after the threshold moves.

---

## 8. Keyboard-up geometry

IME 358px. Usable height 844 − 358 = 486, minus 44 status + 44 nav = **398px of content**.

### 8.1 DPA amount (6h) — number pad

Nav bar gains a `Done` at 15/600 `#1B4D2B`, right padding 12.

| Keeps | Drops |
|---|---|
| Amount label, field, constraint row (98px total) | Deadline presets → one mono line |
| One 40px summary line: `Settle by 6 Oct · 7 trades · no defaults` | Record table (entirely) |
| | Consequence copy + footer button |

Resulting y: 88 label · 109 field top · 159 underline · 171 constraint row · 197 hairline · 211 summary line · 358 keyboard top (486 absolute). Number pad: 4 rows × 46px, 10px gaps, 12/6/28 padding.

### 8.2 Message field (6i) — full keyboard

Nav gains `Done`. A pinned mono line under the nav holds the offer state so it stays true while typing: `Vans 440 → Air Max 480 · 40 added`, 12px mono, 6/4/12 padding, hairline below.

| Keeps | Drops |
|---|---|
| Pinned state line (30px) | Listing header, offering section, gap section, hub section |
| Label + text area (fills to counter) | Footer button — send moves to the keyboard's `return` row context |
| Counter row `Optional` / `124 / 400` at the bottom of the free space | |

Text area top y 130, counter baseline at 470, keyboard at 486. Suggestion strip 34px above the letter rows.

### 8.3 Custom date entry

Date picker is a sheet, not a keyboard — no reflow. Manual amount edit inside the picker uses §8.1 geometry.

### 8.4 Confirmation code entry

Number pad, 358px. Entry cells (68 × 84) sit at y 140. Instruction line 15/23 above at y 100. Your own code drops to a single 15px line at y 240. Nothing else renders.

---

## 9. 360px reflow

Side padding stays 16px → content 328px.

| Element | 390 | 360 |
|---|---|---|
| Gap track | 358 | 328 |
| Item photo (row) | 56 | 52 |
| Item photo (picker) | 60 | 56 |
| Tile photo height | 164 | 150 |
| Code display cell | 56 × 72 | 50 × 68 |
| Code entry cell | 68 × 84 | 62 × 80 |
| Date presets | 3 × ~110 | 3 × ~101, labels `2 wks` / `1 mo` / `2 mos` |
| Gap figure | 44px | 40px |
| Amount field | 40px | 36px |
| Column pair (B) | 300px tall | 268px tall |
| Split buttons | 2 × 175 | 2 × 160 |
| Stack-edit chips (B) | one row of three | wraps to two rows, 8px row gap |

Row heights and all 44px targets are unchanged. Two strings shorten: `Send with 310 and a 200 promise` → `Send 310 + 200 promise`; `Withdraw and offer again` → `Withdraw and re-offer`.

---

## 10. Copy, verbatim

Filipino English. No exclamation marks. Nothing congratulates. Numbers are bare (`480`), the word `Leaves` appears once per context and not on every figure.

### 10.1 Offer flow — chrome

- Nav title: `Offer trade`
- Sheet heading: `Which item are you offering`
- Sheet subtitle: `For Marco's Nike Air Max 90, worth 480 Leaves.`
- Sheet footnote: `Items already promised to another trade don't appear here.`
- Sheet button: `Use this item`
- Section labels: `You're offering` · `The gap` · `The difference` · `Settle the 40` · `Settle the 180` · `What works instead` · `Your message` · `Where you'll meet` · `What Marco will see` · `Dana's record` · `Her open agreements` · `From here` · `Promise ceilings by tier` · `What you sent` · `Change the stack` · `Your two blocks`
- Item row action: `Change`
- Message placeholder: `Add a message (optional)`
- Message counter: `Optional` · `124 / 400`
- Hub subtitle: `Safe-Zone Hub`
- Primary buttons: `Send offer` · `Send offer with 40 Leaves` · `Set up the agreement` · `Send offer with agreement` · `Send as-is anyway` · `Send with 310 and a 200 promise`
- Footnotes: `Marco has three days to reply.` · `Leaves are held, not spent, until Marco replies.` · `You'll name the amount and the deadline next.` · `40 Leaves held from 310 until Marco replies.`

### 10.2 Gap copy, all five

**Even**
> Close enough that there's nothing to settle. You can send this as a straight swap.

Figure `Even`, mono `40 apart`.

**Offering more**
> Your chair is worth 280 Leaves more than Marco's shoes. You can still send it, and Marco can add Leaves to even it out — or you can offer something smaller.

Rows: `Ask Marco to add 280 Leaves` · `Send as-is, no settlement`.

**Small gap**
> You hold 310 Leaves, so this one is covered.

Rows: `Add 40 Leaves from your balance` / `310 now · 270 after` · `Send as-is` / `Marco decides whether the 40 matters.` · `Promise to settle later` / `Deferred Points Agreement.`

**Large gap**
> You hold 310 Leaves. Covering all of it leaves you 130.

Rows: `Add all 180 from your balance` / `310 now · 130 after` · `Add 80 now, promise 100` / `Deferred Points Agreement for the rest.` · `Promise the whole 180` / `Nothing leaves your balance now.` · `Send as-is` / `Some traders accept a gap this size.`

**Very large gap**
> This is a long way apart. Your balance covers 310 of it, which still leaves 1,590 to promise — more than a New Trader can commit to. Two things do work from here.

Routes: `Offer more than one item` / `Your four items together come to 1,620.` · `Watch this listing` / `Two more trades makes you Rising, which raises what you can promise to 900.`
Footnote: `You can still send the shirt on its own. Ivy will see the gap the same way you do.`

The rule these follow: name the number, name what the user already has, hand over a route. Never `unfortunately`, never `you can't afford`, never `only`, never a comparison to other traders.

### 10.3 DPA proposal

- Nav: `Deferred Points Agreement`
- Intro: `A recorded promise to Marco. The trade goes ahead now; you settle the difference by the date you set.`
- Labels: `Amount you'll settle` · `Settle by`
- Constraint row: `80 added now, 100 promised` · `max 400`
- Presets: `2 weeks` · `1 month` · `2 months`; date row `Pick another date`
- Record rows: `Trades completed` · `Settled on time` · `Owed right now`
- Consequence: `If you miss 6 Oct the agreement is marked defaulted, your tier drops, and the 100 stays owed until you settle it.`
- Keyboard summary line: `Settle by 6 Oct · 7 trades · no defaults`
- Direction B extra: `The terracotta block is what Marco is being asked to wait for. Your ceiling as a New Trader is 200.`

### 10.4 Owner accepting (creditor's view)

- Nav: `Offer from Dana L.`
- Summary: `Her jacket 300 for your Air Max 480` / `80 added now · 100 promised`
- Notice: `This offer includes a promise to settle 100 Leaves by 6 Oct.`
- Record: `Trades completed` `14` · `Settled on time` `5 of 6` · `Past defaults` `1, settled late` · `Owed right now` `220 across 2`
- Open agreements: `120 to Renz P.` / `due 22 Sep · 16 days` / `40 paid`; `100 to Jess M.` / `due 1 Oct · 25 days` / `nothing paid`
- Footnote: `Accepting adds 100 to what Dana owes, making 320 in total. You can also accept the trade and waive the difference.`
- Buttons: `Decline` · `Accept` · `Accept without the 100`
- Direction B line: `Two thirds of Dana's side is here now. The terracotta block is a promise to settle 100 Leaves by 6 Oct.`

### 10.5 Offer flow states

**No items**
> You need something to offer first
> A trade in Baylo is one item for another, so nothing can be sent until you have a listing of your own. Post one item and this offer takes about a minute.
> `01` Photograph it and post it. Baylo suggests a value.
> `02` Come back here. We'll keep Marco's shoes saved for you.
> `Post your first item` · `Save this listing for later`

**Not verified**
> `Promise to settle later` / `Needs ID verification. Takes about five minutes.`
> `Verify your ID`
> Verification is only for promises. Everything else in Baylo works without it.

**Tier too low**
> A New Trader can promise up to 200
> This gap needs 640, which is above that ceiling. The limit rises with completed trades — it isn't about this item.
> Ceilings: `New Trader` `you are here` `200` · `Rising` `3 trades` `900` · `Trusted` `10 trades` `2,500` · `Top Trader` `25 trades` `no limit`
> You have one completed trade. Two more moves you to Rising.
> `Add 310 and promise 200` / `Leaves 130 of the gap for Marco to accept or refuse.` · `Offer a different item` / `Your chair at 760 closes most of this.`

**Pending offer**
> You already have an offer on this
> Sent two days ago. Marco has until Tuesday to reply, then it expires on its own.
> `Withdraw and offer again` · `Leave it as it is`

**Sending** — `Sending` · `Holding 40 Leaves`

**Send failed**
> The offer didn't send
> The connection dropped partway. Nothing reached Marco, your 40 Leaves were released back to your balance, and the offer is still here exactly as you built it.
> `Try sending again` · `Keep it and send later`

### 10.6 Trades

- Nav: `Trades`
- Labels: `Needs you today` · `Waiting` · `History`
- History row: `Finished trades` / mono `14 trades`
- Card lines: `Code ready · Marco A.` / `Ayala Center Cebu · today` · `100 promised to Jess M.` / `due 6 Oct · 4 days` · `Offer from Renz P.` / `His guitar 1,450 for your chair 760`
- Waiting rows: `Waiting for Marco · promise of 100` · `Sent 2 days ago · expires Tuesday` · `Accepted · meeting not set`
- Nothing-pending line: `Nothing needs you right now.`

**Empty**
> No trades yet
> When you send or accept an offer it shows up here, along with anything that needs doing on the day.
> `Browse the marketplace`

**Network error**
> Can't load your trades
> The connection dropped. Nothing has changed on your side — offers, promises and codes are all still where they were.
> `Try again` · mono `Last loaded 14:20`

### 10.7 Confirmation codes

- `Show this to Marco` · `Your code is 4182`
- `Ask Marco for his four digits` · `Type them in below`
- `Codes matched 15:42`
- Wrong: `Not a match · 2 tries left`
- After three: `The code changes if either of you leaves the hub. Ask Marco to read it again.` · `Ask Marco to read it again`
- Waiting: `Marco hasn't typed yours in yet. You can both do this at the same time.`

### 10.8 Out-of-reach

- Tile value line: `2,000 Leaves · 860 above your reach`
- Detail label: `Where you stand`
- Detail copy:
> This one is further than your items reach on their own. Your highest is the task chair at 760, and it takes about 1,140 before a swap here is straightforward — so there's 860 to cover another way. Two routes do work.
- Legend: `Your chair 760` · `2,000`
- Routes: `Offer with a promise` / `A Deferred Points Agreement covers up to 200 as a New Trader, so a promise alone will not close this one. Ivy decides whether to take a part-promise.` · `Trade up to it` / `Two trades near your own value usually move the line further than one big offer does.`
- Footnote: `You can send an offer regardless. Ivy sees the same numbers you do.`
- Button: `Offer a trade`

**One-time prompt**
> Why some listings look faded
> Those ones are further than your items reach on their own right now. We keep them in view on purpose, so you can see what things are worth around here.
> mono `within reach` · `further off`
> `01` Faded ones open like any other listing, and you can still send an offer.
> `02` Inside, you'll see the distance and the two ways across it — a promise to settle later, or trading up first.
> `03` The line moves as you post and trade. Nothing is fixed.
> `Got it`

Never in this area: `locked`, `unavailable`, `you can't`, `too expensive`, `upgrade`, `unlock`, or any figure describing the user's total worth.

---

## 11. Motion

- Section reveal on gap change: track segments animate width 220ms `cubic-bezier(.2,.6,.2,1)`; the figure cross-fades 120ms. Nothing bounces.
- Settlement row selection: border colour and fill 120ms linear, no scale.
- Sheet in: 260ms translateY, scrim 180ms fade.
- Sending: the 62% fill breathes `opacity .55 → 1` over 1.4s ease-in-out. No indeterminate sweep.
- Grey tile: no transition. It renders grey from first paint.
- `prefers-reduced-motion`: all of the above become instant state changes; the sending fill holds at a static 62%.

---

## 12. Not built — Direction B (the two columns)

**Archive only. Do not implement.** Recorded so the exploration is not repeated.

B stood the two sides up as bottom-aligned columns with a hairline between them, making the gap the empty space above your side, and turned settling into stacking rather than choosing. It read well at a glance and handled part-settlement elegantly. A won on two counts: the horizontal track holds any magnitude from 40 to 1,900 without the drawing breaking down, and a single track leaves the vertical space that the settlement rows, record tables and ceiling tables need. B needed a special case for off-the-scale listings, which is exactly the case that matters most.

What B was, for the record:

- The gap element becomes the **column pair** (§4): 300px tall, bottom-aligned, 1px centre rule, blocks sized by value ratio with a 15px minimum.
- Settlement isn't a radio list. Leaves arrive as a `#F2F8F3` block with a 1.5px dashed `#1B4D2B` edge; promises as a 1.5px `#C56A4B` outline block. The stack-edit chips (`Add another item`, `Promise instead`, `Remove the 40`, `All Leaves`, `All promised`, `Send short instead`) replace the rows.
- The figure above reads `Level` when the columns match, otherwise `1,900 short`. `Even` is Direction A's word only.
- The picker shows each of your items as a 26 × 62 mini-column against theirs, with mono `440 · reaches 92%`.
- Off-the-scale: rather than a 4px sliver, their column runs past the top of the frame with a `linear-gradient(to bottom, rgba(230,228,218,0) 0, #E6E4DA 64px)` fade, legend `Ivy's side · off the scale`.
- Amount field drops to 36px and sits beside a 78 × 150 miniature of the stack.
- Owner acceptance mirrors the columns — theirs left, the proposer's stack right.
