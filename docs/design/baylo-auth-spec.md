# Baylo — Auth implementation spec

Screens: sign in, create account (5 fields), log in, DOB step after Google, under-18
rejection. Canvas 390 × 844. All values px unless noted. Tokens are identical to
`baylo-direction-1-spec.md` — nothing new was introduced except the sheet radius,
the field styles and the picker/date row.

---

## 1. COLORS

### Surfaces
| Hex | Role |
|---|---|
| #FAFAF7 | Sheet surface (all auth sheets), focused input fill, outline-button fill |
| #F1EFE8 | Input fill — empty, filled, disabled |
| #14140F | Phone frame behind the video band; also primary text |
| #F4F2EA | Build-notes panel (documentation only, not in app) |

### Video band
| Hex / value | Role |
|---|---|
| #3E3A33 / #35322C | Placeholder footage stripes — dev stand-in only, replaced by video |
| rgba(20,20,15,.28) → rgba(20,20,15,.52) | Scrim gradient, top → bottom, on 4a |
| rgba(20,20,15,.30) → rgba(20,20,15,.54) | Scrim on 4d (log in) |
| rgba(20,20,15,.32) → rgba(20,20,15,.56) | Scrim on 4e (Google DOB) |
| rgba(20,20,15,.34) → rgba(20,20,15,.56) | Scrim on 4b (create account) |
| rgba(20,20,15,.40) → rgba(20,20,15,.62) | Scrim on 4f (rejection) — heaviest |
| rgba(250,250,247,.14) | "Cebu" pill fill over video |
| rgba(250,250,247,.12) | Google-account confirmation card fill over video (4e) |
| rgba(250,250,247,.74) | Secondary text over video (email line in 4e) |
| rgba(250,250,247,.66) | "step 2 of 2" eyebrow over video |
| rgba(250,250,247,.62) | Mono status labels over video |
| rgba(20,20,15,.50) | Dev caption chip fill over video |

### Text
| Hex | Role |
|---|---|
| #14140F | Headlines, input values, wordmark over video (as #FAFAF7), mono data values |
| #5C5B52 | Body copy, declaration text, "Naa nay account?" |
| #8C8A7E | Input labels, legal copy, mono eyebrows, helper text |
| #A8A69A | Placeholder text inside empty inputs |
| #FAFAF7 | All text over the video band |
| #EAF6EC | "Cebu" pill label over video |

### Greens
| Hex | Role |
|---|---|
| #3DBE5A | Primary button fill, focused input border, enter key on IME |
| #0B2A15 | On-green label — primary button text, Google "G" glyph, enter icon |
| #1B4D2B | Text buttons ("Show", "Log in", "Forgot password?"), focused input label, confirm-match check, declaration icon |
| #8FE3A6 | Check icon on the Google confirmation card (over video only) |
| rgba(61,190,90,.16) | Focus ring, 3px spread |

### Terracotta (errors and the 18+ block)
| Hex | Role |
|---|---|
| #C56A4B | Error input border (1.5) |
| #B0553A | Error label, error message text, error icon, rejection panel labels |
| #FBEEE9 | Rejection panel fill, rejection icon circle fill |
| #F0D8CE | Rejection panel border, panel internal dividers, icon circle border |

### Borders
| Hex | Role |
|---|---|
| #E2E0D6 | Input border, 1 — empty and filled |
| #D8D6CC | Outline button border, 1 |
| #EDEBE3 | "or" divider rule, 1 |
| #F0D8CE | Rejection panel border, 1 |

### IME mock (dev reference only — the real IME is system-drawn)
| Hex | Role |
|---|---|
| #DEDCD3 | Keyboard background |
| #CFCDC3 | Keyboard top border; modifier key fill |
| #FBFBF8 | Letter key fill |
| #EFEEE7 | Suggestion chip fill |
| #B4B2A6 | Gesture bar pill |
| #3DBE5A | Enter key fill |

---

## 2. TYPE

Fonts: **Bricolage Grotesque** (headlines, wordmark), **Public Sans** (all UI),
**JetBrains Mono** (eyebrows, dates, counters).

| Role | Family / weight | Size | Line height | Letter spacing |
|---|---|---|---|---|
| Wordmark — 4a | Bricolage Grotesque 700 | 24 | 1.0 → 24 | −0.02em → −0.48 |
| Wordmark — 4b/4d/4e/4f | Bricolage Grotesque 700 | 20 | 1.0 → 20 | −0.02em → −0.40 |
| Headline — 4a | Bricolage Grotesque 700 | 27 | 1.2 → 32.4 | 0 |
| Headline — 4d | Bricolage Grotesque 700 | 25 | 1.2 → 30 | 0 |
| Headline — 4e | Bricolage Grotesque 700 | 25 | 1.22 → 30.5 | 0 |
| Headline — 4f | Bricolage Grotesque 700 | 24 | 1.22 → 29.3 | 0 |
| Headline — 4b | Bricolage Grotesque 700 | 23 | 1.2 → 27.6 | 0 |
| Headline — 4c (IME up) | Bricolage Grotesque 700 | 19 | 1.2 → 22.8 | 0 |
| Body — 4a | Public Sans 400 | 15 | 1.55 → 23.25 | 0 |
| Body — 4d/4e/4f | Public Sans 400 | 14 | 1.5–1.55 → 21–21.7 | 0 |
| Subhead — 4b | Public Sans 400 | 13 | 1.5 → 19.5 | 0 |
| Input label | Public Sans 500 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Input label — focused | Public Sans 600 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Input label — error | Public Sans 600 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Input value | Public Sans 500 | 15 | 1.0 → 15 | 0 |
| Input value — password | Public Sans 500 | 15 | 1.0 → 15 | 0.18em → 2.7 |
| Input placeholder | Public Sans 400 | 14 | 1.0 → 14 | 0 |
| Primary button label | Public Sans 700 | 16 | 1.0 → 16 | 0 |
| Outline button label | Public Sans 600 | 15 | 1.0 → 15 | 0 |
| Text button ("Show") | Public Sans 600 | 12 | 1.0 → 12 | 0 |
| Text button ("Forgot password?") | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Text button (footer, "Use a different…") | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| Footer prompt text | Public Sans 400 | 14 | 1.0 → 14 | 0 |
| Declaration line | Public Sans 400 | 12 | 1.5 → 18 | 0 |
| Declaration line — 4c | Public Sans 400 | 11 | 1.5 → 16.5 | 0 |
| Legal copy | Public Sans 400 | 12 | 1.6 → 19.2 | 0 |
| Error message | Public Sans 500 | 12 | 1.4 → 16.8 | 0 |
| Google "G" glyph | Public Sans 600 | 11 | 1.0 → 11 | 0 |
| "or" divider label | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.10em → 1.1, uppercase |
| Field counter ("2 of 5") | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Eyebrow over video ("step 2 of 2") | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.10em → 1.0, uppercase |
| Rejection panel label | Public Sans 500 | 10 | 1.0 → 10 | 0.06em → 0.6, uppercase |
| Rejection panel value (dates, age) | JetBrains Mono 500 | 14 | 1.0 → 14 | 0 |
| Google card name (4e) | Public Sans 600 | 14 | 1.2 → 16.8 | 0 |
| Google card email (4e) | Public Sans 400 | 12 | 1.3 → 15.6 | 0 |
| "Cebu" pill label | Public Sans 500 | 12 | 1.0 → 12 | 0 |
| Avatar initials (4e) | Public Sans 600 | 13 | 1.0 → 13 | 0 |

Truncation: Google card email is 1 line with ellipsis. Headlines use `text-wrap: pretty`,
no clamp — they are authored to fit. Input values are 1 line, no ellipsis (scroll internally).

---

## 3. SPACING

### Screen
- Sheet horizontal padding: **24** (all auth screens, both states)
- Video band content padding: **16** horizontal (12 when a 44 back button leads the row)
- Status/safe-area top inside video band: **44**
- Sheet overlap of video band: **−28** (margin-top), so **visible band = declared band − 28**

### Declared band → visible video
| Screen | Declared band | Visible video | % of 844 |
|---|---|---|---|
| 4a sign in | 281 | 253 | 30.0 |
| 4d log in | 281 | 253 | 30.0 |
| 4e Google DOB | 281 | 253 | 30.0 |
| 4f rejection | 281 | 253 | 30.0 |
| 4b create account, at rest | 200 | 172 | 20.4 |
| 4c create account, IME up | 0 | 0 | 0 |

### Running-y — 4b create account, at rest (band 200, sheet renders 672, inner 648)
| y | Element |
|---|---|
| 0 | Video band top |
| 44 | Back button + wordmark row (44 tall) |
| 156 | Dev caption chip (bottom-anchored, 44 from band bottom) |
| 172 | Sheet visible top, radius 28 |
| 196 | Sheet padding-top 24 ends → headline (27.6 tall) |
| 231 | +7 gap → subhead (19.5 tall) |
| 269 | +18 gap → field 1, Full name (56) |
| 334 | +9 gap → field 2, Email (56) |
| 399 | +9 gap → field 3, Password (56) |
| 464 | +9 gap → field 4, Confirm password (56) |
| 529 | +9 gap → field 5, Date of birth (56) |
| 597 | +12 gap → declaration row (icon 15 + 2 lines, 36 tall) |
| 649 | +16 gap → primary button (52) |
| 715 | +14 gap → legal copy (2 lines, 38.4) |
| 788 | Footer row, 56 tall, pushed by margin-top auto |
| 844 | Screen bottom |

Field stack total: 5 × 56 + 4 × 9 = **316**.

### Running-y — 4a sign in (band 281, sheet flexes to 591, inner 567)
| y | Element |
|---|---|
| 0 | Video band top |
| 44 | Wordmark + "Cebu" pill row |
| 158 | Dev caption chip (centred in band) |
| 253 | Sheet visible top |
| 279 | Padding-top 26 ends → headline (32.4) |
| 321 | +10 gap → body copy (2 lines, 46.5) |
| 396 | +28 gap → Google primary button (52) |
| 468 | +20 gap → "or" divider row (11) |
| 499 | +20 gap → email outline button (52) |
| 573 | +22 gap → legal copy (3 lines, 57.6) |
| 780 | Footer row 64, margin-top auto |
| 844 | Screen bottom |

### Running-y — 4c create account, IME up (sheet 486, IME 358)
| y | Element |
|---|---|
| 0 | Sheet top — square corners, no video, no overlap |
| 26 | Padding-top ends → header row (back 44×32, title, "2 of 5") |
| 68 | +10 gap → field 1, Full name (56) |
| 133 | +9 → field 2, Email — focused (56) |
| 198 | +9 → field 3, Password (56) |
| 263 | +9 → field 4, Confirm password (56) |
| 328 | +9 → field 5, Date of birth (56) |
| 396 | +12 gap → primary button (52) |
| 456 | +8 gap → declaration line (16.5) |
| 476 | Content ends — 10 slack |
| 486 | IME top |
| 844 | Screen bottom |

Column check: 486 + 358 = **844** exactly. Sheet is border-box, no negative margin.

### Gaps, by pair
| From → to | Gap |
|---|---|
| Headline → body/subhead | 10 (7 on 4b) |
| Body → first control | 28 (4a), 22 (4d), 24 (4e), 18 (4b), 10 (4c) |
| Between inputs | **9** (10 on 4d, which has only 2) |
| Input → its error message | 8 |
| Input stack → declaration row | 12 (14 on 4e) |
| Declaration → primary button | 16 (20 on 4e), 12 (4c) |
| Primary → secondary text button | 4 |
| Primary button → legal copy | 14 |
| Primary button → declaration (4c) | 8 |
| Button → "or" divider | 20 (18 on 4d) |
| "or" divider → next button | 20 (18 on 4d) |
| Google button internal (glyph → label) | 10 |
| Outline button internal (icon → label) | 10 |
| Declaration icon → text | 8 |
| Error icon → message | 7 |
| Rejection panel rows | 10, split by 1px #F0D8CE rules |
| Rejection icon → headline | 20 |
| Google card internal (avatar → text → check) | 11 |

### Border radius
| Element | Radius |
|---|---|
| Sheet, at rest | 28 top-left + top-right, 0 bottom |
| Sheet, IME up (4c) | 0 — full-bleed, no corners |
| Input | 10 |
| Primary button | 10 |
| Outline button | 10 |
| Rejection panel | 12 |
| Google confirmation card (4e) | 12 |
| Rejection icon circle | 36 (full, 72 box) |
| "Cebu" pill | 16 |
| Google "G" placeholder ring | 10 (full, 20 box) |
| Avatar (4e) | 19 (full, 38 box) |
| Dev caption chip | 2 |
| Phone frame (mockup only) | 34 |
| IME key | 5 |
| IME suggestion chip | 6 |
| Gesture bar pill | 2 |

---

## 4. COMPONENT SIZES

| Element | Size |
|---|---|
| Input height | **56** (all states, all screens — never changes) |
| Input horizontal padding | 14 (13 when border goes to 1.5, so text never shifts) |
| Input label → value gap | 3 |
| Primary button height | **52** |
| Outline button height | **52** |
| Text button hit height | 44 (48 for footer-level text buttons) |
| Footer row height | 56–64 |
| Back button | 44 × 44 (44 × 32 in the 4c compact header) |
| Google "G" placeholder | 20 × 20, 1.6 ring |
| Rejection icon circle | 72 × 72, 1px border |
| Google card avatar | 38 × 38 |
| Video band content row | 44 tall |
| Sheet overlap | 28 |
| Focus ring spread | 3 |

### Icons
| Icon | Size | Stroke |
|---|---|---|
| Back chevron | 22 | 1.9 |
| Back chevron (4c compact) | 21 | 1.9 |
| Email envelope (outline button) | 19 | 1.6 |
| Calendar (DOB field) | 18 | 1.6 |
| Chevron-down (picker fields) | 18 | 1.7 |
| Confirm-match check | 18 | 2.0 |
| Google card check | 18 | 2.0 |
| Declaration info circle | 15 | 1.7 |
| Error alert circle | 15 | 1.9 |
| Rejection alert circle | 32 | 1.5 |

---

## 5. INPUT STATES

All four states are 56 tall, radius 10. Only fill, border and label colour change —
the text baseline never moves, because padding compensates for border width.

| State | Fill | Border | Label | Value / placeholder | Extra |
|---|---|---|---|---|---|
| **Empty** | #F1EFE8 | 1 #E2E0D6 | 10/500 #8C8A7E | placeholder 14/400 #A8A69A | padding 0 14 |
| **Focused** | #FAFAF7 | 1.5 #3DBE5A | 10/600 #1B4D2B | value 15/500 #14140F | padding 0 13; ring 3 rgba(61,190,90,.16); caret 1.5 × 17 #1B4D2B, 1s step-end blink |
| **Filled** | #F1EFE8 | 1 #E2E0D6 | 10/500 #8C8A7E | value 15/500 #14140F | padding 0 14 |
| **Error** | #FAFAF7 | 1.5 #C56A4B | 10/600 #B0553A | value 15/500 #14140F | padding 0 13; message below at +8, 12/500 #B0553A with a 15 icon at 1.9 |

State add-ons
- Password fields carry a "Show" text button, 12/600 #1B4D2B, right-aligned, 44 hit height.
- Password value letter-spacing 0.18em → 2.7 when masked; 0 when revealed.
- Confirm-password match shows an 18px #1B4D2B check at 2.0 stroke in place of "Show".
- Picker fields (DOB, city) carry a trailing icon at 18, #8C8A7E, and never receive focus
  styling from a keyboard — they take the pressed state and open the native picker.
- Disabled (not drawn): fill #F1EFE8, border 1 #E2E0D6, label and value both #A8A69A.

---

## 6. KEYBOARD-UP GEOMETRY

Measured against a 358 IME (the device figure you gave) on 390 × 844.

### What moves
| Property | At rest (4b) | IME up (4c) |
|---|---|---|
| Video band declared | 200 | 0 |
| Visible video | 172 | 0 |
| Sheet top y | 172 | 0 |
| Sheet rendered height | 672 | 486 |
| Sheet inner height | 648 | 460 |
| Sheet top radius | 28 | 0 |
| Sheet overlap | −28 | none |
| Sheet padding-top | 24 | 26 |

### What drops out
- The whole video band, including the wordmark row — replaced by an in-sheet compact
  header (back 44 × 32 + 19px title + "2 of 5" counter, 32 tall).
- Headline drops 23 → 19, and its subhead line is removed entirely.
- The declaration paragraph collapses from 2 lines at 12/18 to 1 line at 11/16.5,
  centred.
- The legal copy block and the "Naa nay account? Log in" footer are removed.
- Field stack, field height, field gap and button height are all unchanged — that is
  the point of the 56/9/52 numbers.

### What stays fixed
- Input height 56, gap 9, stack total 316.
- Primary button 52, full width inside 24 padding.
- Sheet horizontal padding 24.

### Budget
486 available. 26 + 32 + 10 + 316 + 12 + 52 + 8 + 16 = **476**, leaving 10 slack.

### Numeric / picker variants
- Native date picker (DOB): modal, no IME. Sheet does not reposition.
- If a device reports IME > 380: keep the sheet at (844 − IME), make the field stack
  the scrolling region, and pin the primary button to the sheet bottom with 12 above
  and 12 below. Do not shrink the fields.
- Restore on dismiss: animate sheet top 0 → 172 (4b) or → 253 (4a/4d) over 220ms
  ease-out; the video is never unmounted, so the loop keeps its position.

---

## 7. 360 px REFLOW

Only horizontal values change. Every height, every gap in the vertical stack and the
whole keyboard-up budget are unchanged.

| Property | 390 | 360 |
|---|---|---|
| Sheet horizontal padding | 24 | **20** |
| Video band content padding | 16 | 12 |
| Video band padding when back button leads | 12 | 8 |
| Wordmark — 4a | 24 | 22 |
| Wordmark — other screens | 20 | 19 |
| Headline — 4a | 27 | 25 |
| Headline — 4b/4c | 23 / 19 | 22 / 19 |
| Input horizontal padding | 14 | 13 (12 when border is 1.5) |
| Input height | 56 | 56 |
| Primary / outline button height | 52 | 52 |
| Google button label | 16 | 15 |
| Back button | 44 × 44 | 40 × 44 |
| Rejection panel padding | 14 / 16 | 12 / 14 |
| Rejection panel value | 14 mono | 13 mono |
| Google card padding | 12 | 10 |
| Field stack total | 316 | 316 |
| 4c content budget | 476 of 486 | 476 of 486 |

Content width: 390 − 48 = 342 → 360 − 40 = **320**. The longest strings to check at
320 are "Continue with Google" (fits at 15/700 with the 20 glyph and 10 gap) and
"Correct my date of birth" (fits at 16/700 with 8 to spare; drop to 15 if the device
font scale is above 1.0).
