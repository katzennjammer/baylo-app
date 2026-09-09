# Baylo — Post an item · detection, duplicate check, camera marker

Addendum to the Post-an-item spec. Covers `/api/ai/identify` (step 2),
`/api/ai/phash` (runs on every upload in step 1), and the camera marker.
Tokens are the same set as the feed and auth specs — nothing new is introduced.
Frames: 5p detecting, 5b detected, 5k corrected, 5j detection failed, 5q check
running, 5r self, 5s warned, 5t failed.

---

## 1. COLOURS

### Detection states
| Hex | Used for |
|---|---|
| #FAFAF7 | Sheet surface, all four detection states |
| #EBE9E0 | Skeleton block — primary (the result line, the confirm button) |
| #EFEDE5 | Skeleton block — secondary (category and condition eyebrows, the change button) |
| #14140F | The detected result itself, 22px Bricolage; the corrected result |
| #5C5B52 | The framing line above the result ("We looked at your photo…") |
| #8C8A7E | Category and condition eyebrows, helper text |
| #A8A69A | Struck-through original guess in the corrected state; placeholder text |
| #F1EFE8 | Correction-record strip fill (corrected state); disabled field fill |
| #EAF6EC | "That's right" confirm fill |
| #D2EAD8 | "That's right" confirm border |
| #1B4D2B | Confirm label, Undo, "Change it again" label |
| #D8D6CC | "Change it" outline border |

Detection never uses terracotta. A failed identify is not an error state — 5j has
no warm colour anywhere on it.

### Duplicate check states
| Hex | Used for |
|---|---|
| #E2E0D6 | Check-in-progress track, 2px under the photo |
| #1B4D2B | Check-in-progress fill, 2px — deep forest, not bright green: it is not an action |
| #F1EFE8 | **self** notice fill — grey, no warning colour |
| #5C5B52 | **self** icon and body copy |
| #14140F | **self** heading |
| #FAFAF7 | Inner card inside the self notice (the old listing row) |
| #C56A4B | **warned** 2px rule under the photo; **failed** 3px rule under the photo |
| #B0553A | **warned** heading and icon; **failed** heading, icon, "Reference" label |
| #FBEEE9 | **failed** panel fill only — warned gets no fill |
| #F0D8CE | **failed** panel border and internal divider |
| rgba(250,250,247,.5) | **failed** photo veil, marking it as not attached |
| #EDEBE3 | Neutral border on the warned "other listing" card |
| #E2E0D6 / #A8A69A | Disabled Next in the failed state (fill / label) |

Warned gets colour but no container. Failed gets a container. That difference is
the whole signal — one is a note, the other is a decision.

### Camera marker
| Hex | Used for |
|---|---|
| rgba(20,20,15,.62) | Chip and icon-badge fill over any photo |
| #EAF6EC | Chip icon stroke and label |
| #F1EFE8 | Tapped-explanation tooltip fill |
| #14140F | Tooltip icon and heading |
| #5C5B52 | Tooltip body |

The marker never uses #3DBE5A or #1B4D2B. Green is reserved for actions, and a
green badge reads as a rank or an endorsement, which is exactly what this is not.

---

## 2. TYPE

| Role | Family / weight | Size | Line height | Letter spacing |
|---|---|---|---|---|
| Step heading (all four detection states) | Bricolage Grotesque 700 | 26 | 1.2 → 31.2 | 0 |
| Step heading, keyboard up | Bricolage Grotesque 700 | 19 | 1.25 → 23.75 | 0 |
| Detected result | Bricolage Grotesque 700 | 22 | 1.25 → 27.5 | 0 |
| Framing line above result | Public Sans 400 | 13 | 1.5 → 19.5 | 0 |
| Category / condition eyebrow | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.06em → 0.66, uppercase |
| Confirm / change button label | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| Struck original guess | JetBrains Mono 400 | 12 | 1.4 → 16.8 | 0, line-through |
| Undo | Public Sans 600 | 13 | 1.0 → 13 | 0 |
| Detection-failed body | Public Sans 400 | 14 | 1.5 → 21 | 0 |
| Field label | Public Sans 500 | 10 | 1.0 → 10 | 0.04em → 0.4, uppercase |
| Field value | Public Sans 500 | 15 | 1.0 → 15 | 0 |
| Field placeholder | Public Sans 400 | 14 | 1.0 → 14 | 0 |
| Character counter | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| Helper line | Public Sans 400 | 12 | 1.45 → 17.4 | 0 |
| Check-running line | JetBrains Mono 400 | 11 | 1.0 → 11 | 0.04em → 0.44 |
| phash notice heading (all four) | Public Sans 600 | 15 | 1.35 → 20.25 | 0 |
| phash notice body | Public Sans 400 | 13 | 1.5 → 19.5 | 0 |
| "The other listing" eyebrow | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.10em → 1.0, uppercase |
| Referenced listing title | Public Sans 500 | 14 | 1.3 → 18.2 | 0 |
| Referenced listing meta | Public Sans 400 | 12 | 1.0 → 12 | 0 |
| Old-listing date (self) | JetBrains Mono 400 | 11 | 1.0 → 11 | 0 |
| "Reference" label | JetBrains Mono 400 | 10 | 1.0 → 10 | 0.10em → 1.0, uppercase |
| Reference code | JetBrains Mono 500 | 12 | 1.0 → 12 | 0 |
| Primary button label | Public Sans 700 | 16 | 1.0 → 16 | 0 |
| Outline button label | Public Sans 600 | 15 | 1.0 → 15 | 0 |
| Text button label | Public Sans 600 | 14 | 1.0 → 14 | 0 |
| Camera chip label | Public Sans 500 | 11 | 1.0 → 11 | 0 |
| Marker tooltip heading | Public Sans 600 | 15 | 1.3 → 19.5 | 0 |
| Marker tooltip body | Public Sans 400 | 13 | 1.55 → 20.15 | 0 |

---

## 3. SPACING

Screen padding on all detection states: **20** horizontal. Photo-step states (5q, 5r,
5s, 5t) keep the photo full-bleed at 390 and pad text blocks to 20, buttons to 16.

### 5p detecting — running y
| y | Element |
|---|---|
| 44 | Header row, 44 |
| 100 | Tick rail, 12 above / 14 below |
| 126 | Step heading, 31.2 |
| 177 | +20 → photo tile 96 and the skeleton column beside it |
| 273 | +16 → skeleton confirm row, 44 |
| 339 | +22 → hairline divider, then 22 |
| 362 | Field label 10 |
| 381 | +9 → title field 56 |
| 445 | +8 → helper line 17.4 |

Skeleton column: result block 22 tall at 70% width, then +9, then two eyebrow blocks
11 tall (64 and 58 wide) with an 8 gap. Confirm row is two 44 blocks, gap 10.
All skeletons share one shimmer driver: opacity .55 → 1 → .55, 1600ms, ease-in-out.

### 5b detected / 5k corrected
Identical to 5p above the divider, with real content in place of skeletons.
The correction strip in 5k inserts between the confirm row and the divider:
- Result column → strip: 14
- Strip: 12 vertical / 14 horizontal padding, radius 8, fill #F1EFE8
- Strip → "Change it again" 44 button: 12
- Button → divider: 22

### 5j detection failed
- Heading → photo-and-copy row: 20
- Photo tile 96, gap 14 to the copy column, copy has 4 top padding
- Row → divider: 22, divider → first field label: 22
- Category field 56, then 18 to the next label, 9 label-to-field
- Last field → helper row: 20, helper → "Add a brighter photo" 48: 6

### 5q check running
- Photo bottom → check line: 12
- Check line → thumb rail: 16
- Icon 14, gap 8 to the mono line

### 5r self
- Photo → notice: 16 (20 horizontal margins)
- Notice padding 16, radius 10
- Icon 17, gap 10 to the text column
- Heading → body: 6
- Body → inner listing card: 14; card padding 10, radius 8
- Notice → outline button: 16; outline → text button: 9

### 5s warned
- Photo (with its 2px rule) → notice row: 16
- Icon 17, gap 10, heading → body 6
- Notice → other-listing card: 16; card padding 14, radius 10, border 1 #EDEBE3
- Card → outline button: 16
- Divider at 18 above the closing helper line, helper padding 16 / 20 / 24

### 5t failed
- Photo (3px rule, veiled) → panel: 16
- Panel padding 16, radius 10, border 1
- Icon 18, gap 10; heading → para 1: 6; para 1 → para 2: 10
- Para 2 → reference row: 14, with a 12 top padding above the 1px #F0D8CE divider
- Panel → button stack: 16, stack gap 9
- Three buttons: 52 primary, 52 outline, 48 text
- Divider 18 above the closing helper, helper padding 16 / 20 / 24

### Radii
| Element | Radius |
|---|---|
| Photo hero (full-bleed) | 0 |
| Photo reference tile, 96 | 10 |
| Thumbnail tile, 78 / 104 | 8 |
| Field | 10 |
| Confirm / change button, 44 | 8 |
| Primary / outline button, 52 | 10 |
| phash notice panel | 10 |
| Correction strip | 8 |
| Inner listing card (self) | 8 |
| Other-listing card (warned) | 10 |
| Marker chip, full | 4 |
| Marker badge, compact | 3 |
| Marker tooltip | 12 |
| Skeleton text block | 6 |

---

## 4. COMPONENT SIZES

| Element | Size |
|---|---|
| Photo reference tile (step 2) | 96 × 96 |
| Photo hero (step 1) | 390 × 390, 1:1 |
| Thumbnail tile | 78 × 78 (review screen: 104 × 104) |
| Field | 56 tall |
| Confirm / change buttons | 44 tall, equal flex, gap 10 |
| Primary button | 52 |
| Outline button | 52 |
| Text button | 48 |
| Check-progress bar | 2 tall, full 390 width |
| Upload-progress bar | 3 tall, full 390 width |
| Failed-photo rule | 3 tall, #C56A4B |
| Warned rule | 2 tall, #C56A4B |
| Inner listing thumb (self) | 44 × 44 |
| Other-listing thumb (warned) | 52 × 52 |
| Marker chip, full | 28 tall, padding 0 10, icon 13 |
| Marker badge on 78 tile | 16 × 16, icon 10, inset 4 |
| Marker badge on 104 tile | 18 × 18, icon 11, inset 5 |
| Marker tap target | 44, via 8px invisible padding around the chip |

### Icons and strokes
| Icon | Size | Stroke |
|---|---|---|
| Back chevron | 22 | 1.9 |
| Camera (marker chip) | 13 | 1.8 |
| Camera (compact badge) | 10 / 11 | 2.2 |
| Camera (tooltip, button) | 17 / 20 | 1.7 / 1.9 |
| Magnifier (check running) | 14 | 1.8 |
| Recycle / relist (self) | 17 | 1.8 |
| Alert circle (warned) | 17 | 1.9 |
| Alert circle (failed) | 18 | 1.8 |
| Info circle (helper) | 15 | 1.7 |
| Check (confirm, selected) | 20 | 2.2 |
| Retry arrow | 19 | 2.1 |

---

## 5. STATES

### `/api/ai/identify`
| State | Photo tile | Result area | Confirm row | Title field | Next |
|---|---|---|---|---|---|
| **Detecting** | 96 tile, normal | 3 skeleton blocks, shimmer | 2 skeleton blocks, shimmer | enabled, placeholder | disabled #E2E0D6 / #A8A69A |
| **Detected** | 96 tile, normal | framing line + 22px result + 2 eyebrows | "That's right" #EAF6EC + "Change it" outline | prefilled with suggested title, filled state | enabled #3DBE5A |
| **Corrected** | 96 tile, normal | "You changed this to" + 22px result + 2 eyebrows | replaced by a struck-through record strip + Undo, then a single "Change it again" 44 outline | user value, filled state | enabled |
| **Failed** | 96 tile, normal | one 14px body paragraph, no result, no skeletons | none — replaced by two empty fields | empty, placeholder | disabled until category and title are both set |

Detecting has no timeout copy before 8s. At 8s, swap the framing line to the slow
line (§6). At 15s, treat as failed and move to the failed layout without an error.

### `/api/ai/phash`
| Result | Shown | Photo attached | Can continue |
|---|---|---|---|
| **passed** | nothing, ever | yes | yes |
| **self** | grey notice + the user's old listing | yes | yes — "Keep this photo" is the primary |
| **warned** | 2px terracotta rule + icon-and-text notice + the other listing | yes | yes — "Keep this photo" is the primary |
| **failed** | 3px terracotta rule + veiled photo + filled panel + reference code | **no** | not with this photo; Next disabled until it is replaced or removed |

Running: 2px #1B4D2B determinate bar plus one mono line. Never a modal, never a
blocking spinner. The user can add more photos while it runs.

Fails closed: any error, timeout, or non-response from the Claude comparison
resolves to **failed**. The copy in §6 is written on the assumption that a
meaningful share of failures are honest photos.

---

## 6. ALL COPY, VERBATIM

### Step 2 heading
- Detecting, detected, corrected: `What are you trading?`
- Detection failed: `Tell us what it is`

### Detecting
- Framing line: `Having a look at your photo…`
- Title field placeholder: `What is it? Brand and size help`
- Helper under the field: `You can start typing a title now if you would rather not wait.`
- After 8 seconds, replace the framing line: `Still looking. Your connection may be slow.`
- Save draft in the header is disabled while the call is in flight — label unchanged, colour #A8A69A.

### Detected
- Framing line: `We looked at your photo and think this is a`
- Result: the detected item, sentence case, e.g. `Denim jacket`
- Eyebrows: category and condition, uppercase, separated by a dot — e.g. `CLOTHING · LIKE NEW`
- Confirm button: `That's right`
- Change button: `Change it`
- Title field label: `Give it a title`
- Title helper: `Say the brand and size if you know them. That is what people search for.`
- Counter: `28/70`

### Corrected
- Framing line: `You changed this to`
- Record strip, struck through: `We thought: denim jacket, like new`
- Undo: `Undo`
- Change again button: `Change it again`

Nothing on this screen apologises and nothing marks the change as a problem. The
old guess stays visible only so the correction is legible.

### Detection failed
- Heading: `Tell us what it is`
- Body: `We could not make out this photo well enough to guess. Fill it in yourself — it takes a moment.`
- Category label: `Category`
- Category placeholder: `Choose a category`
- Title label: `Give it a title`
- Title placeholder: `What is it? Brand and size help`
- Helper: `A photo taken in brighter light usually helps us guess, but you do not have to retake it.`
- Text button: `Add a brighter photo`

No "sorry", no "failed", no "error", no warning icon. The helper mentions light
once and then gets out of the way.

### Duplicate check — running
- `Checking this photo against existing listings`

### Duplicate check — passed
No copy. Nothing is shown at any point.

### Duplicate check — self
- Heading: `You used this photo before`
- Body: `It is from your own listing below. If you are posting the same item again, carry on. If this is a different item, use a new photo so traders can tell them apart.`
- Old listing meta: `Traded · 12 July 2026` — or `Still posted` / `Taken down · 3 August 2026`
- Primary: `Keep this photo`
- Outline: `Use a different photo`
- Text: `See my old listing`

### Duplicate check — warned
- Heading: `This photo looks close to one already on Baylo`
- Body: `As far as we can tell it is not the same photo, and similar items do look alike. You can post it as it is. If someone reports the listing, we may check it against the other one.`
- Other-listing eyebrow: `THE OTHER LISTING`
- Other-listing meta: `Posted by another trader in Mandaue`
- Primary: `Keep this photo`
- Outline: `Take my own photo instead`
- Closing helper: `Photos you take in Baylo are not flagged this way, because we know they came from your camera.`

### Duplicate check — failed
- Heading: `We cannot use this photo`
- Paragraph 1: `Our check matched it to a photo already on Baylo, so it was not added. This usually happens with photos saved from the internet or taken from another listing. Sometimes our check is simply wrong.`
- Paragraph 2: `The quickest way through is a photo of the item taken with your own camera. If this photo is yours, tell us and a person will look at it.`
- Reference label: `REFERENCE`
- Reference code format: `DUP-4193-KQ`
- Primary: `Take a photo now`
- Outline: `Choose another photo`
- Text: `This photo is mine — get it checked`
- Closing helper: `Your other photos and everything you filled in are still saved. Only this one photo was left out.`

Four deliberate choices, since this fires on honest photos: it describes what the
check did rather than what the user did; it names the innocent explanation and the
guilty one in the same breath; it admits the check can be wrong before the user has
to argue; and the reference code exists so support can find the decision without
the user having to describe it.

### Support route, after tapping "This photo is mine"
- Confirmation: `Sent. A person will look at this photo within one working day.`
- Body: `We will message you in Baylo either way. You can carry on posting with your other photos while you wait.`

### The camera marker
- Chip label, everywhere: `Photographed in Baylo`
- Tapped explanation heading: `Photographed in Baylo`
- Tapped explanation body: `This photo was taken with the camera inside Baylo, not picked from a gallery. It does not mean we checked the item itself.`
- Step 1 helper, first time the camera is used: `Photos you take in Baylo carry a small camera mark on your listing. It only means the photo came straight from your camera, not from your gallery.`

The second sentence of the explanation is the one that matters. Without it the
marker drifts into meaning "verified", which Baylo cannot support.

---

## 7. KEYBOARD-UP GEOMETRY — step 2

IME 358 on a 844 screen leaves **486**.

What drops out
- The 26px step heading.
- The 96 photo reference tile.
- The framing line and the 22px result, replaced by one 44 summary row:
  28 thumb + `Denim jacket · Clothing · Like new` at 13/500, 1 line with ellipsis,
  + `Change` at 13/600 #1B4D2B on the right. Fill #F1EFE8, radius 8, padding 0 12.
- The confirm row — confirmation moves into that summary row's Change affordance.
- The divider.

What stays
- Header 44 and the tick rail.
- Title field 56, focused, with its caret.
- Helper line, shortened to `Say the brand and size if you know them.`
- Counter.

Budget: 44 header + 26 rail + 44 summary + 20 + 10 label + 9 + 56 field + 8 +
17 helper = **278** of 460 inner. Comfortable, because step 2 has one field.

Next moves into a 56 IME accessory row above the keys: label `Next`, 40 tall,
padding 0 18, radius 8, #3DBE5A on a #EFEEE7 bar with a 1px #CFCDC3 bottom rule.

In the **detection-failed** state with the keyboard up, the category field stays
visible above the title field: budget 44 + 26 + 19 heading + 14 + 10 + 9 + 56 +
18 + 10 + 9 + 56 + 8 + 17 = **296**. Still fits.

---

## 8. 360 px REFLOW

Horizontal only. Every height, gap and the keyboard budget are unchanged.

| Property | 390 | 360 |
|---|---|---|
| Screen padding, detection states | 20 | 16 |
| Text padding on photo states | 20 | 16 |
| Button padding on photo states | 16 | 12 |
| Step heading | 26 | 24 |
| Detected result | 22 | 21 |
| Photo reference tile | 96 | 88 |
| Photo hero | 390 | 360 |
| Thumbnail tile | 78 | 72 (4 across at gap 8 → 336 of 336) |
| Marker chip inset | 12 | 10 |
| Marker chip label | 11 | 11 |
| phash panel padding | 16 | 14 |
| Other-listing thumb | 52 | 48 |
| Inner listing thumb | 44 | 44 |
| Reference code | 12 mono | 11 mono |
| Field, button heights | unchanged | unchanged |

Longest strings to check at 320 content width: `This photo is mine — get it checked`
(fits at 14/600 with 6 to spare) and `This photo looks close to one already on Baylo`
(wraps to 2 lines at 15/600 — allow for it, do not clamp).
