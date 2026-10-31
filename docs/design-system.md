# Baylo design system

Direction: serious, trustworthy, calm. Not cute or childish. Deep forest green primary, muted gold accent used sparingly.

## Colors
| Token | Hex | Use |
|---|---|---|
| Primary | #1F4D3A | Hero, main buttons, active nav, links, verified badge |
| Primary text | #FBFAF7 | Text on green |
| Accent (gold) | #C9A54A | Leaves icon and amount only (on white or green) |
| Accent text | #8A6A1F | Gold text on Accent soft (better contrast than #C9A54A) |
| Accent soft | #F5EEDB | Background for Leaves and Bracket badges |
| Background | #F7F5F0 | Page |
| Surface | #FFFFFF | Cards, sheets, nav, search bar |
| Tint | #E8F0EC | Category circles, photo placeholders |
| Text | #1C2420 | Main text |
| Muted text | #6B726D | Subtitles, details |
| Border | #E5E2DA | All 1px borders |
| Success | #2F7D55 | Confirmations |
| Warning | #B7791F | Expiring soon |
| Danger | #B4412F | Notification counts, errors |

## Type
Font: Figtree only (needs the @expo-google-fonts/figtree package; not installed yet).
- Display (hero greeting): 22 / line 1.2, Bold, slightly tight letter spacing
- Sheet title: 20 / 1.25, Bold
- Section title: 17 / 1.2, Bold
- Card title: 15 or 14 / 1.3, Semibold
- Body: 14 or 13 / 1.4, Regular
- Caption: 12 / 1.3, Medium
- Small (nav, badges): 11 / 1.2, Medium or Semibold

## Radius
Inputs and buttons 12, cards 12, photos inside cards 8, badges 6, sheet top 16, category circles fully round.

## Borders
1px Border color everywhere. Never use dark outlines.

## Shadows
- Small (cards): 0 1px 3px rgba(28,36,32,.08)
- Raised (floating buttons, Post button, sheets): 0 8px 24px -8px rgba(28,36,32,.14)
React Native can't do negative-spread shadows: approximate with shadow props plus Android elevation.

## Spacing
4, 8, 12, 16, 20, 24, 32. Pages have 20px side margins, sections 32px apart, cards in a row 12px apart.

## Components
- Primary button: 44-48 tall, green fill, white text, Semibold 14-15, radius 12.
- Secondary button: 44 tall, 1px outline, green text. Use the white version on the green hero.
- Text button: no fill, green Semibold text.
- Category chip: 56px circle in Tint, 22px green icon, label in Caption below, 68px wide.
- Card: white, 1px border, small shadow, radius 12. Photo on top, 12-14px padding, fixed height so cards line up. Shop cards 78% of screen width; listing cards 44%.
- Input: 44 tall, white, radius 12, 18px icon in muted text.
- Badge: Leaves and Bracket use Accent soft background with Accent text, Semibold 11-12, radius 6. Notification counts are 16px Danger dots.
- Bottom nav: white, 1px top border, 22px icons, 11px labels. Active tab green. Post button is a 48px green rounded square with the Raised shadow. Leave room for the gesture bar.
- "Help me find": 44 tall green button with Raised shadow, 88px above the nav, 20px from the right edge. Label "Help me find" with a search icon. It is a keyword search helper, NOT AI: no sparkle icon, no "AI" wording.

## Success sheet ("Listing posted")
White, 1px border, top radius 16, 36x4 handle, Raised shadow. Mascot 80px. Title 20 Bold, body 14 muted, centered. Preview row: 1px border, radius 12, 48px thumbnail, title, "Visible to nearby traders", "+5" gold badge. Then a 48px "View listing" button and a text-style "Done" button.

## Mascot rules
Appears only in the hero (Home), empty states (48px), and success sheets (80px). Never on listing cards, shop cards, buttons, or the nav.

## Copy
Clear and friendly, no "Quack!" style wording, no emojis (use icon components).
