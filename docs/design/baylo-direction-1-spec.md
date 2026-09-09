# Baylo — Direction 1 ("Quiet Feed") implementation spec

Canvas 390 × 844. All values in px unless noted. Everything below is measured from
`Baylo Home Feed.dc.html` (option 1a) and `Baylo Feed States.dc.html`.

---

## 1. COLORS

### Surfaces
| Hex | Role |
|---|---|
| #FAFAF7 | App background AND card surface (cards are not tinted — they are separated by dividers, not elevation) |
| #F5F3EC | Inset surface — "Matches for you" interstitial background |
| #F1EFE8 | Chip / control fill (trending chips, tier badge "Rising", failed-photo placeholder) |
| #F3F2EC | Stories "+ Post" circle fill |
| #F4F2EA | Spec/notes panel fill (not in app chrome) |

### Text
| Hex | Role |
|---|---|
| #14140F | Primary text — wordmark, item title, username, chip labels on light fill |
| #5C5B52 | Secondary text — social counts, condition/category chip text, body copy |
| #8C8A7E | Muted text — distance, timestamp, "this week", section subcopy |
| #A8A69A | Disabled / stale — Leaves pill when offline, "last synced" line |
| #7C7A6E | Photo-placeholder caption text (dev placeholder only) |

### Greens
| Hex | Role |
|---|---|
| #1B4D2B | Deep forest — Leaves numerals, leaf icon, active tab label + icon, tier badge text, secondary text buttons |
| #3DBE5A | Bright green — primary button fill, Post FAB fill, unread badge fill, unviewed story ring, "Top Trader" badge fill |
| #0B2A15 | On-green text/icon — label inside any #3DBE5A surface |
| #EAF6EC | Green tint fill — Leaves pill, "Trusted" badge |
| #D2EAD8 | Green tint border — Leaves pill, "Trusted" badge |

### Warm accent (use sparingly — likes and urgency only)
| Hex | Role |
|---|---|
| #C56A4B | Liked heart fill + stroke, liked count text |
| #B0553A | Urgency text — "Moving out Sunday" chip text, offline banner text/icon |
| #FBEEE9 | Urgency fill — urgency chip, offline banner background |
| #F0D8CE | Urgency border — urgency chip, offline banner top/bottom rules |

### Borders and dividers
| Hex | Role |
|---|---|
| #EDEBE3 | Divider — under header, between cards, above tab bar, around failed-photo block |
| #E2E0D6 | Chip / control border (condition, category, trending chips); viewed story ring |
| #D8D6CC | Stronger control border — "Tap to reload" button |
| #C9C7BC | Dashed border — stories "+ Post" ring (1.5 dashed) |

### Tab bar
| Hex | Role |
|---|---|
| #FAFAF7 | Tab bar background |
| #EDEBE3 | Tab bar top hairline (1) |
| #1B4D2B | Active tab icon stroke + label |
| #8C8A7E | Inactive tab icon stroke + label |
| #3DBE5A | Post FAB fill |
| #0B2A15 | Post FAB plus icon |
| #FAFAF7 | 4px ring around Post FAB (same as surface) |

### Badges and chips — fill / border / text
| Component | Fill | Border | Text |
|---|---|---|---|
| Leaves pill (header) | #EAF6EC | #D2EAD8 | #1B4D2B |
| Leaves chip (card) | #EAF6EC | #D2EAD8 | #1B4D2B |
| Tier: New | #F1EFE8 | #E2E0D6 | #8C8A7E |
| Tier: Rising | #F1EFE8 | #E2E0D6 | #8C8A7E |
| Tier: Trusted | #EAF6EC | #D2EAD8 | #1B4D2B |
| Tier: Top Trader | #3DBE5A | none | #0B2A15 |
| Condition chip | transparent | #E2E0D6 | #5C5B52 |
| Category chip | transparent | #E2E0D6 | #5C5B52 |
| Urgency chip | #FBEEE9 | #F0D8CE | #B0553A |
| Trending chip | #F1EFE8 | #E2E0D6 | #14140F |
| Unread badge | #3DBE5A | 2px #FAFAF7 ring | #0B2A15 |
| Primary button | #3DBE5A | none | #0B2A15 |

### Error / banner / skeleton
| Hex | Role |
|---|---|
| #FBEEE9 | Offline banner background |
| #F0D8CE | Offline banner top and bottom 1px rules |
| #B0553A | Offline banner text, icon, timestamp |
| #EBE9E0 | Skeleton block — primary (avatar, photo, title, button) |
| #EFEDE5 | Skeleton block — secondary (metadata line, chips) |
| #B4B2A6 | Failed-photo icon stroke |

Skeleton animation: opacity 0.55 → 1 → 0.55, 1600ms, ease-in-out, infinite. All
blocks in a card animate in phase (one shared driver), not staggered.

---

## 2. TYPE

Fonts: **Bricolage Grotesque** (display: wordmark, item titles, empty/error headlines),
**Public Sans** (all UI text), **JetBrains Mono** (eyebrows, timestamps, dev labels).

Line heights given as multiplier and resolved px. Letter spacing in em and resolved px.

| Role | Family / weight | Size | Line height | Letter spacing |
|---|---|---|---|---|
| Wordmark "Baylo" | Bricolage Grotesque 700 | 24 | 1.0 → 24 | −0.02em → −0.48 |
| Wordmark @360 | Bricolage Grotesque 700 | 22 | 1.0 → 22 | −0.02em → −0.44 |
| Item title | Bricolage Grotesque 600 | 17 | 1.3 → 22.1 | 0 |
| Empty-state headline | Bricolage Grotesque 700 | 23 | 1.25 → 28.75 | 0 |
| Error headline | Bricolage Grotesque 700 | 22 | 1.25 → 27.5 | 0 |
| Username | Public Sans 600 | 14 | 1.2 → 16.8 | 0 |
| Metadata (distance · time) | Public Sans 400 | 12 | 1.3 → 15.6 | 0 |
| Tier badge | Public Sans 600 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Leaves value (header) | Public Sans 600 | 14 | 1.0 → 14 | 0, tabular numerals |
| Leaves value (header @360) | Public Sans 600 | 13 | 1.0 → 13 | 0, tabular numerals |
| Leaves value (card chip) | Public Sans 700 | 13 | 1.0 → 13 | 0, tabular numerals |
| Condition / category chip | Public Sans 500 | 12 | 1.0 → 12 | 0 |
| Urgency chip | Public Sans 600 | 12 | 1.0 → 12 | 0 |
| Primary button label | Public Sans 700 | 15 | 1.0 → 15 | 0.01em → 0.15 |
| Empty-state primary button | Public Sans 700 | 16 | 1.0 → 16 | 0 |
| Secondary text button | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| Social count | Public Sans 500 | 13 | 1.0 → 13 | 0, tabular numerals |
| Section heading (Trending / Matches) | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Section subcopy | Public Sans 400 | 12 | 1.4 → 16.8 | 0 |
| Section eyebrow ("this week") | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Trending chip label | Public Sans 500 | 13 | 44 (fills chip) | 0 |
| Matches item title | Public Sans 600 | 13 | 1.3 → 16.9 | 0 |
| Matches Leaves value | Public Sans 600 | 12 | 1.0 → 12 | 0 |
| Stories label — "Post" | Public Sans 600 | 11 | 1.0 → 11 | 0 |
| Stories label — handle | Public Sans 400 | 11 | 1.0 → 11 | 0, 1 line, ellipsis |
| Tab label — active | Public Sans 600 | 10 | 1.0 → 10 | 0 |
| Tab label — inactive | Public Sans 500 | 10 | 1.0 → 10 | 0 |
| Unread badge count | Public Sans 700 | 10 | 17 (fills badge) | 0, tabular numerals |
| Avatar initials (40) | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Avatar initials (62) | Public Sans 600 | 15 | 1.0 → 15 | 0 |
| Empty-state body | Public Sans 400 | 14 | 1.55 → 21.7 | 0 |
| Offline banner text | Public Sans 600 | 12 | 1.3 → 15.6 | 0 |
| "last synced" line | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |

Truncation rules
- Item title: 2 lines max, then ellipsis (≈62 characters at 17/22.1 in a 390 screen).
- Username: 1 line, ellipsis; the tier badge never shrinks or wraps (flex-shrink 0).
- Metadata: 1 line, ellipsis.
- Stories handle: 1 line, ellipsis, max width = avatar width (62).

---

## 3. SPACING

### Screen
- Horizontal padding: **16** (all rows: header, owner row, title block, section headers, chip rails)
- Header: 44 top safe area + 44 content row + 10 bottom = **98** total, 1px bottom divider
- Tab bar: **86** total height (56 item row + 8 top padding + 22 bottom safe area), 1px top divider
- Scroll area: everything between the two

### Between cards
- Gap between cards: **0** — cards are separated by a 1px #EDEBE3 divider, not by a gap
- Card padding: **14** top, **18** bottom, 0 horizontal (photo is edge-to-edge; text rows carry their own 16)

### Vertical rhythm inside a card
| From → to | Gap |
|---|---|
| Card top → owner row | 14 |
| Owner row → photo | 12 |
| Photo → item title | 14 |
| Item title → chip row | 10 |
| Chip row → social row | 8 |
| Social row → primary button | 6 |
| Primary button → card bottom | 18 |

- Owner row internal gap (avatar → text → kebab): **10**
- Owner row: username → metadata: **3**
- Title row: title → Leaves chip: **12** (Leaves chip is flex-shrink 0)
- Chip row gap: **7**, wraps
- Social row: items sit in a 44-tall row, 10 horizontal padding each, row offset −10 horizontally so the first icon optically aligns to the 16 margin

### Stories row
- Padding: 14 top, 16 horizontal, 16 bottom
- Gap between items: **14**
- Avatar → label gap: **7**
- 1px bottom divider

### Trending interstitial
- Section padding: 18 top, 18 bottom
- Header → chip rail: 12
- Chip gap: **8**
- 1px bottom divider

### Matches interstitial
- Section padding: 18 top, 18 bottom, background #F5F3EC
- Header block → rail: 12
- Heading → subcopy: 4
- Card gap: **10**
- Thumb → title: 8; title → Leaves: 5

### Border radius
| Element | Radius |
|---|---|
| Card | 0 (edge-to-edge, divider-separated) |
| Primary button | 10 |
| Empty-state primary button | 11 |
| Condition / category / urgency chip | 6 |
| Trending chip | 22 (pill, height 44) |
| Leaves pill — header | 17 (pill, height 34) |
| Leaves chip — card | 15 (pill, height 30) |
| Tier badge | 4 |
| Owner avatar | 20 (full circle at 40) |
| Stories avatar | 31 (full circle at 62) |
| Post FAB | 29 (full circle at 58) |
| Unread badge | 9 (pill at height 17) |
| Matches thumbnail | 8 |
| Photo placeholder caption | 2 |
| Skeleton block — text line | half its height (pill) |
| Failed-photo "Tap to reload" | 22 (pill, height 44) |
| Device frame (mockup only) | 34 |

---

## 4. COMPONENT SIZES

### Avatars
- Owner row: **40 × 40**, radius 20
- Stories: **62 × 62** outer. Ring = 2px fill (#3DBE5A unviewed / #E2E0D6 viewed), then 2px #FAFAF7 gap, then 54 × 54 image
- Stories "+ Post": 62 × 62, 1.5 dashed #C9C7BC, fill #F3F2EC

### Item photo
- Default aspect ratio: **1:1**, full 390 width, edge-to-edge, no radius
- Clamp for real uploads: max tall **4:5**, max wide **16:9**, centre-crop between
- Failed state: keeps the 1:1 box so scroll position never jumps; fill #F1EFE8 with 1px #EDEBE3 top and bottom
- Matches thumbnail: **132 × 132**
- Expand affordance on non-square photos: bottom-right label, 9/JetBrains Mono, rgba(20,20,15,0.55) fill, 6×8 padding

### Buttons and hit targets
| Element | Height | Width / padding |
|---|---|---|
| Primary "Offer Trade" | **48** | full width inside 16 margins, radius 10 |
| Empty-state primary | 52 | full width inside 24 margins, radius 11 |
| Secondary text button | 48 | full width, no fill |
| Error retry | 50 | 26 horizontal padding |
| Social action (like/comment/share) | 44 | 10 horizontal padding each |
| Header icon button | 44 × 44 | 44 at 390; 40 wide × 44 tall at 360 |
| Kebab (owner row) | 44 × 44 | offset −12 right to align optically |
| Trending chip | 44 | 14 horizontal padding |
| Tab item | 56 | flex 1 of 5 |
| Post FAB | 58 × 58 | raised −20 above tab bar, 4px #FAFAF7 ring, shadow 0 8 18 rgba(61,190,90,0.42) |
| "Tap to reload" | 44 | 18 horizontal padding |

Nothing tappable is under 44 tall. The tier badge, chips inside a card and the
Leaves chip are display-only (not tappable) and may be shorter.

### Icons — all 1.6 stroke unless noted, round caps and joins
| Icon | Size | Stroke |
|---|---|---|
| Header bell, messages | 21 | 1.6 |
| Header leaf (in Leaves pill) | 15 | 1.7 |
| Header leaf @360 | 14 | 1.7 |
| Card Leaves chip leaf | 13 | 1.8 |
| Social heart / comment / share | 21 | 1.6 |
| Kebab dots | 18 | filled, r 1.6 |
| Tab icon — active | 22 | 1.9 |
| Tab icon — inactive | 22 | 1.6 |
| Post FAB plus | 26 | 2.1 |
| Stories "+ Post" plus | 20 | 1.6 |
| Offline banner warning | 16 | 1.8 |
| Failed-photo image icon | 34 | 1.4 |
| Retry arrow (error state) | 19 | 2.1 |
| Retry arrow (failed photo) | 16 | 1.9 |
| Empty-state leaf | 42 | 1.4 |
| Empty-state icon circle | 96 × 96 | fill #EAF6EC, 1px #D2EAD8 |
| Error icon circle | 88 × 88 | fill #F1EFE8, 1px #E2E0D6 |

### Badges
- Unread: height **17**, min-width 17, horizontal padding 4 (5 for "99+"), radius 9,
  2px #FAFAF7 ring outside the fill, positioned top 2 / right 0 of the 44 button
  (right −4 when the label is "99+")
- Caps at **99+**
- Leaves: fixed height 34 (32 at 360), padding 10 left / 12 right, never shrinks —
  the wordmark yields first. Tabular numerals so 1,240 and 9,999 are the same width.
  Above 99,999 format as "9.9k".

### Shadows
- Cards: none (dividers only)
- Post FAB: 0 8 18 rgba(61, 190, 90, 0.42)
- Device frame drop shadow is mockup presentation only — do not implement

---

## 5. RESPONSIVE — 360 px

Only the header changes; everything else reflows on flex.
- Screen horizontal padding: 16 → **12**
- Header gap between items: 10 → **6**
- Wordmark: 24 → **22**
- Leaves pill: height 34 → **32**, leaf 15 → 14, numerals 14 → 13, padding 9 left / 10 right
- Header icon buttons: 44 wide → **40** wide, height stays 44
- Item photo, card rhythm, tab bar, button heights: unchanged
