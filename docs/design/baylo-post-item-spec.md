# Baylo — Post an item · implementation spec

Direction A, "the tick rail". Canvas 390 × 844. All values px unless noted.
Fonts: **Bricolage Grotesque** (display), **Public Sans** (UI), **JetBrains Mono**
(eyebrows, counters, dates, codes). Tokens are the same set as the feed and auth
specs; the only new components are the tick rail, the value slider, the hub row and
the camera marker.

Frames: 5a photos · 5b what is it · 5c condition · 5d value · 5e in return ·
5f hubs · 5g review · 5h uploading · 5i failed upload · 5j detection failed ·
5k corrected · 5l re-valuation used · 5m step-2 keyboard · 5n step-5 keyboard ·
5o draft · 5p detecting · 5q check running · 5r self · 5s warned · 5t failed ·
5u camera marker.

---

## 1. COLOURS

### Surfaces
| Hex | Used for |
|---|---|
| #FAFAF7 | Screen background, sheet surface, focused field fill, outline-button fill |
| #F1EFE8 | Inset surface — field fill, correction strip, self notice, draft row, marker tooltip |
| #F3F2EC | Add-photo tile fill (dashed) |
| #FBEEE9 | Failed-duplicate panel fill only |
| #EAF6EC | Green tint — Leaves chip, selected condition row, selected hub row, confirm button, selected chip |
| rgba(20,20,15,.62) | Camera marker chip and badge fill, over photos |
| rgba(20,20,15,.55) | Photo remove button fill, over photos |
| rgba(250,250,247,.86) | Photo caption chip fill (dev placeholder only) |
| rgba(250,250,247,.34) | Uploading veil over the photo |
| rgba(250,250,247,.42) | Failed-upload veil |
| rgba(250,250,247,.50) | Blocked-photo veil (duplicate failed) |
| rgba(20,20,15,.42) | Scrim behind the draft sheet |

There is no elevated surface in this flow. Cards are replaced by hairlines and
inset fills — nothing casts a shadow except the value-slider thumb and the draft
sheet.

### Text
| Hex | Used for |
|---|---|
| #14140F | Primary — step headings, field values, detected result, condition names, hub names, review titles |
| #5C5B52 | Secondary — step subheadings, body copy, notice bodies, IME suggestion |
| #8C8A7E | Muted — field labels, helper lines, hub landmark notes, mono eyebrows, counters on grey |
| #A8A69A | Disabled and placeholder — placeholder text, struck original guess, disabled button labels, locked slider values |
| #0B2A15 | On-green — primary button labels, IME enter icon, Post FAB glyph |
| #EAF6EC | On-dark — camera marker label over a photo |
| #1B4D2B | Deep forest — see below |
| #B0553A | Warm accent text — see below |

### Greens
| Hex | Used for |
|---|---|
| #1B4D2B | Deep forest: Leaves numerals and leaf icon, done ticks, text buttons (Save draft, Edit, Undo, Skip for now), selected-row descriptions and checks, focused field labels, duplicate-check progress fill |
| #3DBE5A | Bright action: primary button fill, current tick, focused field border, selected tile border, IME enter key |
| #EAF6EC | Tint fill (see surfaces) |
| #D2EAD8 | Tint border — Leaves chip, confirm button, selected chip |
| rgba(61,190,90,.16) | Focus ring, 3px spread; selected-condition ring |

Green never appears on the camera marker, on any warning, or on a skeleton.

### Warm accent — #C56A4B family
Allowed in exactly four places: a failed upload, a warned duplicate, a failed
duplicate, and "Discard this draft". Nowhere else in the flow.

| Hex | Used for |
|---|---|
| #C56A4B | 3px rule under a failed upload; 2px rule under a warned photo; 3px rule under a blocked photo |
| #B0553A | Warning and error headings, icons, "Discard this draft" label, "Reference" label |
| #FBEEE9 | Failed-duplicate panel fill |
| #F0D8CE | Failed-duplicate panel border and internal divider |

### Borders, dividers, hairlines
| Hex | Used for |
|---|---|
| #EDEBE3 | Section dividers, footer top rule, header bottom rule, neutral cards, review section rules |
| #E2E0D6 | Field border 1, chip border 1, unselected tile border, slider track, upcoming ticks, disabled button fill |
| #D8D6CC | Outline-button border 1, unselected hub checkbox 1.5 |
| #C9C7BC | Dashed add-photo border 1.5, slider band markers, locked slider thumb ring, eyebrow separator dot |
| #F0D8CE | Failed-panel border (see warm accent) |
| #CFCDC3 | IME top border and modifier keys (system-drawn; reference only) |

### Chips and badges
| Component | Fill | Border | Text |
|---|---|---|---|
| Condition tag (review) | transparent | 1 #E2E0D6 | #5C5B52 |
| Category tag (review) | transparent | 1 #E2E0D6 | #5C5B52 |
| Return-category chip, unselected | #FAFAF7 | 1 #E2E0D6 | #14140F |
| Return-category chip, selected | #EAF6EC | 1 #D2EAD8 | #1B4D2B |
| Return-category chip (review) | #EAF6EC | 1 #D2EAD8 | #1B4D2B |
| Trending / suggestion chip | #F1EFE8 | 1 #E2E0D6 | #14140F |
| Leaves chip | #EAF6EC | 1 #D2EAD8 | #1B4D2B |
| Camera marker chip | rgba(20,20,15,.62) | none | #EAF6EC |
| Primary button | #3DBE5A | none | #0B2A15 |
| Disabled button | #E2E0D6 | none | #A8A69A |

### Error, warning, success
| State | Rule / icon | Heading | Body | Container |
|---|---|---|---|---|
| Failed upload | 3 #C56A4B | #B0553A | #5C5B52 | none |
| Duplicate warned | 2 #C56A4B | #B0553A | #5C5B52 | none |
| Duplicate failed | 3 #C56A4B | #B0553A | #5C5B52 | #FBEEE9 / 1 #F0D8CE |
| Field error | 1.5 #C56A4B border | label #B0553A | message #B0553A | none |
| Rate limited | 16 clock icon #5C5B52 | #14140F | #5C5B52 | #F1EFE8 |
| Re-valuation used | 16 clock icon #5C5B52 | #14140F | #5C5B52 | #F1EFE8 |
| Duplicate self | 17 relist icon #5C5B52 | #14140F | #5C5B52 | #F1EFE8 |
| Detection failed | no icon, no rule | — | #5C5B52 | none |
| Success (confirm, match, selected) | check #1B4D2B | — | — | #EAF6EC |

Warning versus block is carried by **container, not hue**: a note gets colour and
no box, a block gets the box. Detection failing gets neither.

### Progress indicator — the tick rail
| Tick | Width | Height | Radius | Colour |
|---|---|---|---|---|
| Done | 13 | 2 | 2 | #1B4D2B |
| Current | 26 | 3 | 2 | #3DBE5A |
| Upcoming | 13 | 1 | 0 | #E2E0D6 |

Gap 5. Seven ticks: six at 13 plus one at 26 = 104, plus 30 of gaps = **134** total
width, left-aligned with 4 of inset. Height of the row is the current tick's 3.
No labels, no counter, no percentage. Transition on step change: the leaving tick
animates 26 → 13 and #3DBE5A → #1B4D2B, the arriving tick 13 → 26 and
#E2E0D6 → #3DBE5A, 200ms ease-out, simultaneous.

### Skeleton and loading
| Hex | Used for |
|---|---|
| #EBE9E0 | Primary skeleton block — result line, confirm button, photo area |
| #EFEDE5 | Secondary skeleton block — eyebrows, metadata lines, change button |
| #E2E0D6 | Determinate track (upload 3px, duplicate check 2px) |
| #3DBE5A | Upload progress fill, 3px |
| #1B4D2B | Duplicate-check progress fill, 2px |

Shimmer: opacity 0.55 → 1 → 0.55, 1600ms, ease-in-out, infinite. Every block in a
given step shares one driver — no stagger.

---

## 2. TYPE

| Role | Family / weight | Size | Line height | Letter spacing |
|---|---|---|---|---|
| Step heading | Bricolage Grotesque 700 | 26 | 1.2 → 31.2 | 0 |
| Step heading, keyboard up | Bricolage Grotesque 700 | 19 | 1.25 → 23.75 | 0 |
| Step subheading | Public Sans 400 | 14 | 1.5 → 21 | 0 |
| Step subheading (step 2 detection line) | Public Sans 400 | 13 | 1.5 → 19.5 | 0 |
| Detection result | Bricolage Grotesque 700 | 22 | 1.25 → 27.5 | 0 |
| Leaves value, step 4 | Bricolage Grotesque 600 | 56 | 1.0 → 56 | −0.03em → −1.68, tabular |
| Leaves value, review | Bricolage Grotesque 600 | 22 | 1.0 → 22 | 0, tabular |
| Review item title | Bricolage Grotesque 600 | 17 | 1.3 → 22.1 | 0 |
| Screen title in header | Public Sans 600 | 15 | 1.0 → 15 | 0 |
| Condition name | Public Sans 600 | 16 | 1.2 → 19.2 | 0 |
| Condition description | Public Sans 400 | 12 | 1.35 → 16.2 | 0 |
| Hub name | Public Sans 600 | 15 | 1.2 → 18 | 0 |
| Hub type eyebrow | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.06em → 0.6, uppercase |
| Hub landmark note | Public Sans 400 | 12 | 1.35 → 16.2 | 0 |
| Field label | Public Sans 500 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Field label, focused | Public Sans 500 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Field value | Public Sans 500 | 15 | 1.0 → 15 | 0 |
| Field value, multiline | Public Sans 400 | 15 | 1.55 → 23.25 | 0 |
| Field placeholder | Public Sans 400 | 14 | 1.0 → 14 | 0 |
| Helper text | Public Sans 400 | 12 | 1.45 → 17.4 | 0 |
| Helper text, long-form | Public Sans 400 | 12 | 1.5 → 18 | 0 |
| Character counter | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Error / warning heading | Public Sans 600 | 15 | 1.35 → 20.25 | 0 |
| Error / warning body | Public Sans 400 | 13 | 1.5 → 19.5 | 0 |
| Field error message | Public Sans 500 | 12 | 1.4 → 16.8 | 0 |
| Primary button label | Public Sans 700 | 16 | 1.0 → 16 | 0 |
| Outline button label | Public Sans 600 | 15 | 1.0 → 15 | 0 |
| Text button label | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| Small text button (Save draft, Edit, Undo, Change) | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Confirm / change button (step 2) | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| IME accessory button | Public Sans 700 | 14 | 1.0 → 14 | 0 |
| Chip label | Public Sans 500 | 13 | 1.0 → 13 | 0 |
| Chip label, selected | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Tag label (review) | Public Sans 500 | 12 | 1.0 → 12 | 0 |
| Review section label | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.10em → 1.0, uppercase |
| Category / condition eyebrow (step 2) | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.06em → 0.66, uppercase |
| Photo counter | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Hub counter | JetBrains Mono 400 | 12 | 1.0 → 12 | 0 |
| Slider band value | JetBrains Mono 500 | 12 | 1.0 → 12 | 0 |
| Slider band label | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.06em → 0.66, uppercase |
| Provenance line (step 4) | Public Sans 500 | 13 | 1.0 → 13 | 0 |
| Reference code | JetBrains Mono 500 | 12 | 1.0 → 12 | 0 |
| Reference label | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.10em → 1.0, uppercase |
| Struck original guess | JetBrains Mono 400 | 12 | 1.4 → 16.8 | 0, line-through |
| Camera marker label | Public Sans 500 | 11 | 1.0 → 11 | 0 |
| Marker tooltip heading | Public Sans 600 | 15 | 1.3 → 19.5 | 0 |
| Marker tooltip body | Public Sans 400 | 13 | 1.55 → 20.15 | 0 |
| Draft sheet heading | Bricolage Grotesque 700 | 22 | 1.25 → 27.5 | 0 |
| Draft row title | Public Sans 500 | 14 | 1.3 → 18.2 | 0 |
| Draft row meta | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Check-running line | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.04em → 0.44 |

Truncation
- Review item title: 2 lines, then ellipsis.
- Hub name: 1 line, ellipsis. Landmark note: 1 line, ellipsis.
- Draft row title: 1 line, ellipsis.
- Step-2 keyboard summary row: 1 line, ellipsis.
- Step headings and subheadings: `text-wrap: pretty`, no clamp.

---

## 3. SPACING

### Shared chrome — identical on all seven steps
| Block | Value |
|---|---|
| Status / safe area | 44 |
| Header row | 44 (back or close 44×44, title, small text button right with 12 inset) |
| Header horizontal padding | 12 |
| Tick rail | 12 above, 14 below, 4 of left inset |
| Header block total | **114** |
| Footer top rule | 1 #EDEBE3 |
| Footer padding | 12 top, 16 horizontal, 26 bottom |
| Footer button | 52 |
| Footer block total | **90** (91 with the rule) |
| Scroll area | **640** |

Screen padding inside the scroll area: **20** on text steps (2, 3, 4, 5), **0** on
full-bleed photo rows (1), **20** on hub text and **0** on hub rows (they are
edge-to-edge with hairlines), **20** on review sections. Button stacks inside the
scroll area pad to **16** to line up with the footer button.

### Step 1 — photos · running y
| y | Element |
|---|---|
| 0 | Screen top |
| 44 | Header row 44 |
| 100 | Tick rail (with the photo counter right-aligned on the same line) |
| 114 | Scroll top → hero photo, 390 × 390 |
| 504 | +12 → thumbnail rail, 78 tall |
| 594 | +18 → "Take a photo" 52 |
| 655 | +9 → "Choose from gallery" 52 |
| 723 | +16 → marker helper row (icon 15 + 3 lines) |
| — | +24 bottom padding |
| 754 | Footer rule, then Next |

- Hero photo: full-bleed, no radius, no margin.
- Marker chip on hero: 12 from left, 12 from bottom.
- Remove button on hero: 12 from right, 12 from top, 44 × 44.
- Thumbnail rail: 16 horizontal padding, gap 8, 4 tiles of 78 = 336 of 358.
- Camera before gallery, always: camera earns the marker.

### Step 2 — what is it · running y
| y | Element |
|---|---|
| 114 | Scroll top |
| 114 | Step heading 31.2 |
| 165 | +20 → reference tile 96 and the result column beside it, gap 14 |
| 261 | +16 → confirm row, two 44 buttons, gap 10 |
| 327 | +22 → divider 1 |
| 350 | +22 → field label 10 |
| 369 | +9 → title field 56 |
| 433 | +8 → helper row (helper left, counter right, baseline-aligned) |

Result column internals: framing line 19.5 → +5 → result 27.5 → +8 → eyebrow row
(11 tall, dot separator 3 × 3, gap 8).
Corrected state inserts, after the result column: +14 → correction strip
(12 vertical / 14 horizontal padding) → +12 → "Change it again" 44 → +22 → divider.

### Step 3 — condition · running y
| y | Element |
|---|---|
| 114 | Step heading 31.2 |
| 156 | +11 → prefill note (check 14 + one line 18.2) |
| 194 | +20 → option list |
| — | 5 rows of 68, gap 9 → **376** |
| 570 | +24 bottom padding |

Row internals: 16 horizontal padding (15 when the border goes to 1.5), name 19.2,
+4, description 16.2. Selected row adds a 20 check at the right, gap 12.

### Step 4 — value · running y
| y | Element |
|---|---|
| 114 | Step heading 31.2 |
| 179 | +34 → the numeral block, centred |
| 179 | Leaf icon 30 + numeral 56, gap 11 |
| 247 | +12 → provenance row (icon 14 + 13px line, gap 7) |
| 290 | +30 → slider row, 44 tall |
| 338 | +4 → band row (min left, label centre, max right) |
| 376 | +26 → divider 1 |
| 403 | +16 → limit helper (icon 15 + 2 lines) |

Re-valuation-used state replaces the helper with a 14/16 padded #F1EFE8 panel at
+24 from the band row, then the helper at +18 below it.

### Step 5 — in return · running y
| y | Element |
|---|---|
| 114 | Step heading 31.2 |
| 156 | +11 → subheading, 2 lines, 42 |
| 220 | +22 → text area, 132 minimum |
| 360 | +8 → helper row (helper left, counter right) |
| 400 | +22 → divider 1 |
| 423 | +22 → chip group label 10 |
| 445 | +12 → chip rows, 44 tall, gap 8, wrapping |

Text area: 14 padding all round (13 when focused), no inner box, `min-height: 132`,
grows to 220 then scrolls internally.

### Step 6 — hubs · running y
| y | Element |
|---|---|
| 114 | Step heading 31.2 (in a fixed block, 20 padding) |
| 156 | +11 → subheading, 2 lines, 42 |
| 214 | +16 → end of the fixed block |
| 215 | First hairline, then the scrolling list |
| — | Rows of 76, each followed by a 1 #EDEBE3 hairline |

Row internals: 20 horizontal padding, name and type eyebrow on one line with gap 8,
+5, landmark note. Trailing control at the right, gap 12.
Footer on this step is taller: counter row 44 (counter left, "Skip for now" right),
then 10, then the 52 button → footer block **122**.

### Step 7 — review · running y
| y | Element |
|---|---|
| 114 | Step heading 31.2, in a 20-padded block with 18 below |
| 163 | Photo rail: two 104 tiles + a remainder tile, gap 8, 20 padding, 18 below |
| 285 | Hairline, then the section stack |

Each section: 16 vertical / 20 horizontal padding, then a 1 #EDEBE3 hairline.
Section internals: label 10 → +8 → content → +8 or +10 → tags.
Edit target sits right, 52 wide × 44 tall, gap 12 from the content column.
Closing helper after the last hairline: 16 / 20 / 24 padding.

### Border radii
| Element | Radius |
|---|---|
| Hero photo | 0 |
| Thumbnail tile | 8 |
| Add-photo tile | 8 |
| Reference tile (96) | 10 |
| Review photo tile (104) | 8 |
| Field | 10 |
| Text area | 10 |
| Primary / outline button (52) | 10 |
| Confirm / change button (44) | 8 |
| Text button | 0 |
| Chip (44) | 22 |
| Tag (review) | 6 |
| Leaves chip | 15 |
| Condition row | 10 |
| Hub row | 0 |
| Hub checkbox | 6 |
| Slider track | 2 |
| Slider thumb | 14 |
| Notice panel (self, rate limit, re-valuation) | 10 |
| Failed-duplicate panel | 10 |
| Correction strip | 8 |
| Other-listing card | 10 |
| Inner listing row (self, draft) | 8 |
| Marker chip | 4 |
| Marker badge | 3 |
| Marker tooltip | 12 |
| Draft sheet | 20 top corners only |
| Draft grabber | 2 |
| Skeleton text block | 6 |
| IME key | 5 |
| Device frame (mockup only) | 34 |

---

## 4. COMPONENT SIZES

### Photos
| Element | Size |
|---|---|
| Hero photo | 390 × 390, 1:1, full-bleed |
| Hero photo, real uploads | clamp between 16/9 and 4/5, centre-cropped |
| Thumbnail tile | 78 × 78 |
| Thumbnail gap | 8 |
| Thumbnail rail | 4 across = 336 of 358 available |
| Selected thumbnail | 1.5 #3DBE5A border, inset (box-sizing border-box) |
| Unselected thumbnail | 1 #E2E0D6 |
| Add-photo tile, next slot | 78 × 78, 1.5 dashed #C9C7BC on #F3F2EC, plus icon 20 at 1.7 |
| Add-photo tile, later slots | 78 × 78, 1 dashed #E2E0D6 on #FAFAF7, empty |
| Remove button on hero | 44 × 44, radius 22, rgba(20,20,15,.55), X icon 19 at 1.8 |
| Reference tile (step 2) | 96 × 96 |
| Review tile | 104 × 104 |
| Review remainder tile | flex, 104 tall, 1 #EDEBE3, label `+0` in 11 mono #A8A69A |
| Upload progress bar | 3 tall, full width, track rgba(20,20,15,.12), fill #3DBE5A |
| Duplicate check bar | 2 tall, full width, track #E2E0D6, fill #1B4D2B |
| Maximum photos | 5 |

### Camera and gallery entry points
| Element | Size |
|---|---|
| "Take a photo" | 52 tall, full width inside 16, #3DBE5A, camera icon 20 at 1.9, gap 9 |
| "Choose from gallery" | 52 tall, full width inside 16, 1 #D8D6CC on #FAFAF7, image icon 19 at 1.6, gap 9 |
| Both, disabled | fill #E2E0D6 / border #E2E0D6, icon and label #A8A69A |

### Condition options
| Element | Size |
|---|---|
| Row | 68 tall, full width inside 20 |
| Row gap | 9 |
| Padding | 16 horizontal (15 when selected, so text does not shift) |
| Unselected | 1 #E2E0D6 on #FAFAF7 |
| Selected | 1.5 #3DBE5A on #EAF6EC, ring 3 rgba(61,190,90,.16) |
| Check | 20 at 2.2, #1B4D2B, right-aligned, gap 12 |
| Options | New / Like new / Good / Fair / Poor — five, always all five, never a picker |

### Value slider
| Element | Size |
|---|---|
| Row height | 44 (the hit area) |
| Track | 4 tall, radius 2, #E2E0D6, full width inside 20 |
| Fill | 4 tall, #3DBE5A, from track start to the thumb |
| Thumb | 28 × 28, radius 14, #FAFAF7, 2 #3DBE5A, shadow 0 2 6 rgba(20,20,15,.16) |
| Band markers | 2 wide × 12 tall, #C9C7BC, at both track ends |
| Band row | min value left, band label centred, max value right, 4 below the track |
| Locked thumb | #F1EFE8 fill, 2 #C9C7BC, no shadow |
| Locked track | #E2E0D6, no fill segment |
| Leaf icon beside the numeral | 30 at 1.5 |
| Provenance icon | 14 at 1.8 |

The track **is** the band. Its ends are the ±25% limits, so the wall is visible
before the first drag and the thumb simply stops. There is no over-drag, no rubber
band, no toast on hitting the end. Step: 5 Leaves. Haptic tick at each end.

### Chips
| Element | Size |
|---|---|
| Return-category chip | 44 tall, padding 0 14, radius 22 |
| Selected chip | adds a 14 check at 2.2, gap 7 |
| Chip gap | 8, wrapping |
| Review tag | padding 7 10, radius 6, no fixed height |

### Hub rows
| Element | Size |
|---|---|
| Row | 76 tall, 20 horizontal padding |
| Divider | 1 #EDEBE3 above and below every row |
| Unselected | #FAFAF7, 22 × 22 checkbox at radius 6, 1.5 #D8D6CC |
| Selected | #EAF6EC fill, 20 check at 2.2 #1B4D2B in place of the checkbox |
| Selected text | name #14140F, eyebrow and note shift to #1B4D2B |
| Maximum | 5 of 22 |
| Counter | in the footer, left, 12 mono #8C8A7E |

### Buttons
| Element | Height |
|---|---|
| Footer primary | 52 |
| In-flow primary / outline | 52 |
| Confirm / change (step 2) | 44 |
| Text button | 48 |
| Small text button (header, Edit, Undo) | 44 hit area |
| IME accessory button | 40, inside a 56 bar |
| Hub row, condition row | 68 / 76 (the row is the target) |
| Chip | 44 |

Nothing tappable is under 44.

### Icons and strokes
| Icon | Size | Stroke |
|---|---|---|
| Back chevron / close X | 22 | 1.9 |
| Camera (primary button) | 20 | 1.9 |
| Camera (marker chip) | 13 | 1.8 |
| Camera (marker badge, 78 / 104 tile) | 10 / 11 | 2.2 |
| Camera (tooltip) | 17 | 1.7 |
| Gallery | 19 | 1.6 |
| Add photo plus | 20 | 1.7 |
| Remove X on hero | 19 | 1.8 |
| Leaf (step 4 numeral) | 30 | 1.5 |
| Leaf (review) | 18 | 1.7 |
| Trade arrows (provenance) | 14 | 1.8 |
| Check (selected condition, hub, confirm) | 20 | 2.2 |
| Check (chip, prefill note) | 14 | 1.8 |
| Chevron down (picker field) | 18 | 1.7 |
| Info circle (helper) | 15 | 1.7 |
| Clock (rate limit, re-valuation) | 16 | 1.8 |
| Relist arrows (duplicate self) | 17 | 1.8 |
| Alert circle (warned) | 17 | 1.9 |
| Alert circle (failed upload, failed duplicate) | 17 / 18 | 1.9 / 1.8 |
| Retry arrow | 19 | 2.1 |
| Magnifier (check running) | 14 | 1.8 |

---

## 5. STATES

### Fields — all four, on a 56 row (text area: 132)
| State | Fill | Border | Label | Value |
|---|---|---|---|---|
| Empty | #F1EFE8 | 1 #E2E0D6 | 10/500 #8C8A7E | placeholder 14/400 #A8A69A |
| Focused | #FAFAF7 | 1.5 #3DBE5A, padding −1 | 10/500 #1B4D2B | 15/500 #14140F, caret 1.5 × 17 #1B4D2B, 1s step-end |
| Filled | #F1EFE8 | 1 #E2E0D6 | 10/500 #8C8A7E | 15/500 #14140F |
| Error | #FAFAF7 | 1.5 #C56A4B, padding −1 | 10/500 #B0553A | 15/500 #14140F, message below at +8 |
| Disabled | #F1EFE8 | 1 #E2E0D6 | #A8A69A | #A8A69A |

Focus ring 3 rgba(61,190,90,.16) on focused; no ring on error.

### Buttons
| State | Fill | Label |
|---|---|---|
| Enabled primary | #3DBE5A | #0B2A15 |
| Pressed primary | #35A94F | #0B2A15 |
| Disabled primary | #E2E0D6 | #A8A69A |
| Enabled outline | #FAFAF7, 1 #D8D6CC | #14140F |
| Disabled outline | #FAFAF7, 1 #E2E0D6 | #A8A69A |
| Loading primary | #3DBE5A, label swaps to a 20 spinner in #0B2A15 | — |

### Per-step Next gating
| Step | Next enabled when |
|---|---|
| 1 photos | at least 1 photo has finished uploading |
| 2 what is it | category set (detected or chosen) **and** title ≥ 3 characters |
| 3 condition | always — it is prefilled |
| 4 value | always |
| 5 in return | always — the whole step is optional |
| 6 hubs | always — "Skip for now" is a real route |
| 7 review | always; the label becomes "Post this item" |

### Upload
| State | Photo | Thumb | Entry buttons | Next |
|---|---|---|---|---|
| Uploading | veil rgba(250,250,247,.34), 3px determinate bar, caption `uploading · 62%` | 50% opacity | disabled | disabled until the first upload completes |
| Done | normal | normal, 1.5 #3DBE5A if selected | enabled | enabled |
| Failed | veil rgba(250,250,247,.42), 3px #C56A4B rule, photo **kept** | normal | enabled | disabled while zero photos have uploaded |

Failed upload never removes the photo — it is held locally and retried in the
background. "Try again" 52 primary with a 19 retry icon; "Remove this photo" 48
text button in #1B4D2B.

### Detection — `/api/ai/identify`
| State | Result area | Confirm row | Title field | Next |
|---|---|---|---|---|
| Detecting | 3 shimmer blocks (22 at 70%, then two 11 at 64 and 58) | 2 shimmer blocks, 44 | enabled, placeholder | disabled |
| Detected | framing line + 22 result + 2 eyebrows | "That's right" #EAF6EC + "Change it" outline | prefilled, filled state | enabled |
| Corrected | "You changed this to" + 22 result + 2 eyebrows | struck record strip + Undo, then one "Change it again" 44 outline | user value | enabled |
| Failed | one 14/21 paragraph, no result | replaced by a category picker field | empty, placeholder | disabled until category + title |

Timing: no extra copy before 8s. At 8s the framing line becomes the slow line. At
15s treat as failed and move to the failed layout — without an error.

### Duplicate check — `/api/ai/phash`
| Result | Shown | Photo attached | Continue |
|---|---|---|---|
| passed | nothing, ever | yes | yes |
| self | grey #F1EFE8 notice + the user's own old listing | yes | yes, "Keep this photo" is primary |
| warned | 2 #C56A4B rule + icon-and-text notice, no container, + the other listing | yes | yes, "Keep this photo" is primary |
| failed | 3 #C56A4B rule + veiled photo + #FBEEE9 panel + reference code | **no** | not with this photo |

Running: 2px #1B4D2B determinate bar plus one mono line. Never a modal. More
photos can be added while it runs.

**Fails closed.** Any error, timeout, or non-response from the comparison resolves
to `failed`. The copy in §8 assumes a real share of blocks are honest photos.

### Re-valuation limit reached
Slider goes flat: track #E2E0D6 with no fill segment, thumb #F1EFE8 with a
2 #C9C7BC ring and no shadow, band values and label drop to #A8A69A, band label
becomes `LOCKED`. The numeral stays #14140F at 56 — it is still the real value.
A #F1EFE8 panel (14/16 padding, radius 10, clock icon 16) carries the explanation.
Footer button becomes "Save changes".

### Rate limited
A #F1EFE8 panel in the same shape as the re-valuation panel, clock icon 16
#5C5B52, heading 15/600 #14140F, body 13/19.5 #5C5B52, and a mono countdown
`Try again in 2:14` at 12/500 #14140F. The action that triggered it is disabled
for the duration; everything else on the step stays usable. Applies to detection
retries, duplicate re-checks, and posting.

### Draft on leaving mid-flow
**Decision: yes, there is a draft.** One per account, saved automatically on every
step transition and on every field blur, kept **30 days**, then deleted with a
notification three days before. Starting a new post while a draft exists opens the
draft; a second concurrent draft is not offered.

Sheet: scrim rgba(20,20,15,.42), sheet #FAFAF7 with 20 top radius, 24 horizontal
padding, 24 top / 26 bottom, grabber 38 × 4 radius 2 #E2E0D6 centred with 20 below.
Heading 22 Bricolage → +10 → body 14/21.7 → +18 → draft row (#F1EFE8, radius 10,
12 padding, 44 thumb at radius 8, gap 12) → +20 → "Keep draft and leave" 52
primary → +6 → "Carry on posting" 48 text #1B4D2B → "Discard this draft" 48 text
#B0553A → +10 → retention line 12/18 #8C8A7E centred.

Discarding asks once more, inline, replacing the three buttons with
"Yes, discard it" (52, #C56A4B fill, #FFFFFF label) and "No, keep it" (48 text).

---

## 6. KEYBOARD-UP GEOMETRY

IME **358** on 844 leaves **486**. Two steps have text fields: 2 and 5. The date
and category pickers are native modals and do not reposition anything.

### Step 2 — title
Sheet becomes a fixed 486 block, `box-sizing: border-box`, so 486 + 358 = 844 exactly.

Drops out
- The 26 step heading.
- The 96 reference tile.
- The framing line and the 22 result.
- The confirm row.
- The divider.

Replaced by
- One **44** summary row: 28 thumb at radius 6, then
  `Denim jacket · Clothing · Like new` at 13/500 #14140F on one line with ellipsis,
  then `Change` at 13/600 #1B4D2B. Fill #F1EFE8, radius 8, padding 0 12.

Stays
- Header 44 and the tick rail 26.
- Title field 56, focused.
- Helper, shortened to one line, and the counter.

Budget: 44 + 26 + 44 + 20 + 10 + 9 + 56 + 8 + 17 = **234** of the 442 inner
(486 − 44 top padding). Comfortable — one field.

Next moves into a **56** IME accessory bar: #EFEEE7, 1 #CFCDC3 bottom rule, two
suggestion words at 13, then a 40-tall #3DBE5A button at padding 0 18 radius 8,
label `Next` at 14/700 #0B2A15.

### Step 2 — detection failed, keyboard up
Both fields must stay visible. Heading drops to 19 rather than out.
Budget: 44 + 26 + 24 + 14 + 10 + 9 + 56 + 18 + 10 + 9 + 56 + 8 + 17 = **301** of
442. Fits.

### Step 5 — what you want in return
The text area is the step, so it keeps its full **132** and does not shrink.

Drops out
- The 2-line subheading.
- Nothing else — the divider and the chip label stay, and the chip rows fall below
  the fold. Chips are optional and reachable once the keyboard closes.

Changes
- Heading 26 → 19.

Budget: 44 + 26 + 24 + 14 + 132 + 8 + 17 + 16 + 1 + 14 + 10 = **306** of 442,
with the first chip row partly visible at the fold — which is the intended hint
that more sits below.

Accessory button label is `Done`, not `Next`: it dismisses the keyboard so the
chips can be reached, rather than advancing the step.

### Fallback for taller IMEs
If a device reports IME > 380: keep the sheet at (844 − IME), make the field block
the scrolling region, and pin the primary to the sheet bottom with 12 above and
12 below. Never shrink a field below 56 or the text area below 132.

---

## 7. 360 px REFLOW

Horizontal only. Every height, every vertical gap and both keyboard budgets are
unchanged.

| Property | 390 | 360 |
|---|---|---|
| Text-step padding | 20 | 16 |
| Header padding | 12 | 8 |
| Button-stack padding | 16 | 12 |
| Hub row padding | 20 | 16 |
| Review section padding | 20 | 16 |
| Step heading | 26 | 24 |
| Step heading, keyboard up | 19 | 19 |
| Detection result | 22 | 21 |
| Leaves numeral | 56 | 52 |
| Hero photo | 390 | 360 |
| Thumbnail tile | 78 | 72 (4 across at gap 8 = 336 of 336) |
| Reference tile | 96 | 88 |
| Review tile | 104 | 96 |
| Marker chip inset | 12 | 10 |
| Slider thumb | 28 | 28 |
| Condition row | 68 | 68 |
| Hub row | 76 | 76 |
| Field, text area, buttons | unchanged | unchanged |
| Tick rail total | 134 | 134 |

Content width: 390 − 40 = 350 → 360 − 32 = **328**.
Longest strings to check at 328: `This photo is mine — get it checked` (fits at
14/600), `Fair — clear wear or small damage, still usable` (description wraps to 2
lines at 12/16.2 — allow the 68 row to grow to 76 rather than clamping), and
`This photo looks close to one already on Baylo` (2 lines at 15/600).

---

## 8. ALL COPY, VERBATIM

Header title on every step: `Post an item`. On step 4 reached from an existing
listing: `Edit listing`. Header right button: `Save draft` (disabled and #A8A69A
while a detection or upload call is in flight).

### Step 1 — photos
- Heading: none. The photo is the heading.
- Photo counter: `2 of 5 photos`
- Primary: `Take a photo`
- Secondary: `Choose from gallery`
- Marker helper: `Photos you take in Baylo carry a small camera mark on your listing. It only means the photo came straight from your camera, not from your gallery.`
- Footer: `Next`
- Empty state, before any photo: `Add a photo to start` as the heading above the two buttons, with `Two or three photos from different angles get more offers than one.` as the helper.
- At the limit: `That is the maximum of five photos. Remove one to add another.`

### Step 2 — what is it
- Heading (detecting, detected, corrected): `What are you trading?`
- Heading (detection failed): `Tell us what it is`
- Detecting line: `Having a look at your photo…`
- Detecting, after 8 seconds: `Still looking. Your connection may be slow.`
- Detected framing line: `We looked at your photo and think this is a`
- Detected result: sentence case, e.g. `Denim jacket`
- Eyebrows: `CLOTHING · LIKE NEW`
- Confirm: `That's right`
- Change: `Change it`
- Corrected framing line: `You changed this to`
- Correction record: `We thought: denim jacket, like new`
- Undo: `Undo`
- Change again: `Change it again`
- Detection failed body: `We could not make out this photo well enough to guess. Fill it in yourself — it takes a moment.`
- Detection failed helper: `A photo taken in brighter light usually helps us guess, but you do not have to retake it.`
- Detection failed text button: `Add a brighter photo`
- Category label: `Category`
- Category placeholder: `Choose a category`
- Title label: `Give it a title`
- Title placeholder: `What is it? Brand and size help`
- Title helper: `Say the brand and size if you know them. That is what people search for.`
- Title helper, keyboard up: `Say the brand and size if you know them.`
- Counter: `28/70`
- Title error, too short: `Add a few more words so people know what it is.`
- Footer: `Next`

Nothing in the failed state says sorry, error, or failed, and it carries no icon
and no warm colour. It is an ordinary form that happens not to be prefilled.

### Step 3 — condition
- Heading: `How is it holding up?`
- Prefill note: `We filled this in from your photo. Change it if it is off.`
- Options and their descriptions:
  - `New` — `Never used, tags may still be on`
  - `Like new` — `Used once or twice, no marks`
  - `Good` — `Used often, works as it should`
  - `Fair` — `Clear wear or small damage, still usable`
  - `Poor` — `Needs repair, say what is wrong in your title`
- Footer: `Next`

### Step 4 — value
- Heading: `What is it worth in Leaves?`
- Provenance, with comparable trades: `Suggested from 6 similar trades`
- Provenance, single comparable: `Suggested from 1 similar trade`
- Provenance, no comparables: `Category estimate — no similar trades yet`
- Band label: `±25% band`
- Band label, locked: `LOCKED`
- Band values: the two limits, e.g. `315` and `525`
- Limit helper: `You can move the value 25% either way. After you post, you can ask us to value it again once.`
- At either end of the band: `That is as far as the value can move — 25% from what we suggested.`
- Re-valuation used, heading: `You have used your one re-valuation`
- Re-valuation used, body: `Each listing can be valued again once, and this one already was on 2 September. The value stays at 455 Leaves for as long as it is posted.`
- Re-valuation used, helper: `If the item has changed since you posted it, take the listing down and post it again as a new one.`
- Footer: `Next`, or `Save changes` when reached from an existing listing

### Step 5 — what you want in return
- Heading: `What are you hoping to get?`
- Subheading: `Say what you have in mind. No need to be strict — people will still offer things you did not think of.`
- Text area placeholder: `A bag, shoes, something for the kitchen…`
- Helper: `You can leave this open if you are not sure yet.`
- Counter: `96/300`
- Chip group label: `Categories you would consider — optional`
- Footer: `Next`

### Step 6 — where you'll meet
- Heading: `Where can you meet?`
- Subheading: `Pick up to five public places near you. Traders will choose from these when they make an offer.`
- Counter: `2 of 5 chosen`
- Skip: `Skip for now`
- At the limit: `That is five places. Uncheck one to add another.`
- Empty, no hubs near: `No Safe-Zone Hubs near you yet. You can post without one and agree a place in chat.`
- Footer: `Next`

### Step 7 — review and post
- Heading: `Have a last look`
- Section labels: `ITEM` · `VALUE` · `HOPING TO GET` · `MEETING PLACES` · `PHOTOS`
- Each section's right control: `Edit`
- Value section suffix: `Leaves`, with `From 6 similar trades` or `Category estimate` below
- Meeting places, when skipped: `None chosen — you can agree a place in chat.`
- Hoping to get, when blank: `Open to offers.`
- Closing helper: `Once posted, traders near you can send offers. You can take the listing down any time.`
- Footer: `Post this item`
- Posting: `Posting…`
- Posted: `Your listing is up.` with `See it in the feed` as a text button.

### Duplicate check — all four
Running: `Checking this photo against existing listings`

**passed** — no copy. Nothing is shown at any point.

**self**
- Heading: `You used this photo before`
- Body: `It is from your own listing below. If you are posting the same item again, carry on. If this is a different item, use a new photo so traders can tell them apart.`
- Old listing meta: `Traded · 12 July 2026`, or `Still posted`, or `Taken down · 3 August 2026`
- Primary: `Keep this photo`
- Outline: `Use a different photo`
- Text: `See my old listing`

**warned**
- Heading: `This photo looks close to one already on Baylo`
- Body: `As far as we can tell it is not the same photo, and similar items do look alike. You can post it as it is. If someone reports the listing, we may check it against the other one.`
- Other-listing label: `THE OTHER LISTING`
- Other-listing meta: `Posted by another trader in Mandaue`
- Primary: `Keep this photo`
- Outline: `Take my own photo instead`
- Closing helper: `Photos you take in Baylo are not flagged this way, because we know they came from your camera.`

**failed**
- Heading: `We cannot use this photo`
- Paragraph 1: `Our check matched it to a photo already on Baylo, so it was not added. This usually happens with photos saved from the internet or taken from another listing. Sometimes our check is simply wrong.`
- Paragraph 2: `The quickest way through is a photo of the item taken with your own camera. If this photo is yours, tell us and a person will look at it.`
- Reference label: `REFERENCE`
- Reference code format: `DUP-4193-KQ`
- Primary: `Take a photo now`
- Outline: `Choose another photo`
- Text: `This photo is mine — get it checked`
- Closing helper: `Your other photos and everything you filled in are still saved. Only this one photo was left out.`
- After tapping the text button: `Sent. A person will look at this photo within one working day.` / `We will message you in Baylo either way. You can carry on posting with your other photos while you wait.`

Because the check fails closed, the failed copy does four things deliberately: it
describes what the check did rather than what the user did; it names the innocent
and the guilty explanation in the same breath; it admits the check can be wrong
before the user has to argue; and the reference code means support can find the
decision without the user having to describe it.

### The camera marker
- Chip label, every size: `Photographed in Baylo`
- Tapped heading: `Photographed in Baylo`
- Tapped body: `This photo was taken with the camera inside Baylo, not picked from a gallery. It does not mean we checked the item itself.`

The second sentence is the one that matters. Without it the marker drifts into
meaning "verified", which Baylo cannot support.

### Draft prompt
- Heading: `Your draft is saved`
- Body: `We kept your photos and everything you filled in. Pick it up from the Post tab whenever you are ready.`
- Draft row meta: `4 of 7 steps · 2 photos`
- Primary: `Keep draft and leave`
- Text: `Carry on posting`
- Text, terracotta: `Discard this draft`
- Retention line: `Drafts are kept for 30 days. You can have one draft at a time.`
- Discard confirmation: `Discard this draft? Your photos and answers will be deleted.` with `Yes, discard it` and `No, keep it`
- Expiry notification, 3 days out: `Your draft listing will be deleted in 3 days. Open it to finish posting.`

### Every error message
- Upload failed, heading: `This photo did not finish uploading`
- Upload failed, body: `Your photo is still here on your phone. Check your data or Wi-Fi and send it again.`
- Upload failed, primary: `Try again`
- Upload failed, text: `Remove this photo`
- Upload failed, background note: `Baylo keeps trying quietly in the background while you carry on with the next steps.`
- Photo too large: `That photo is too big to send. Baylo will make it smaller — this may take a moment.`
- Unsupported file: `Baylo can use JPG, PNG and HEIC photos. Pick another one.`
- No connection, on Next: `No connection. We saved your draft — try again once you are back online.`
- Title required: `Add a few more words so people know what it is.`
- Category required: `Choose a category so people can find this.`
- Post failed: `We could not post this just now. Your draft is safe. Try again in a moment.`
- Rate limited, heading: `Give it a moment`
- Rate limited, body: `You have tried this a few times in a row. Wait a little and try again — nothing you filled in was lost.`
- Rate limited, countdown: `Try again in 2:14`
- Rate limited, posting: `You have posted several items quickly. You can post again in 4 minutes.`
- Session expired: `You were signed out. Sign in again and your draft will still be here.`
