# Baylo mobile app: Copilot rules

This is D:\BAYLO\baylo-mobile (Expo, Expo Router, React Native, NativeWind). Work ONLY inside this folder. NEVER create, edit, rename, or delete files in D:\BAYLO\baylo (the Next.js web app), baylo-mobile-hubfix, or any other folder. If a task seems to need changes outside this folder, stop and ask.

Visual design rules are in docs/design-system.md. Follow them for all UI work.

Rules:
- Put colors, radius, spacing, and shadows in src/theme/tokens.js and palette.js. Don't hardcode hex values in screens.
- Visual changes only. Don't change data fetching, navigation, routes, or trade/bracket logic unless asked.
- Keep Tappable.tsx's NativeWind/Pressable workaround. Keep SearchHelper's zIndex/elevation and the safe-area handling in AppHeader and TabBar.
- Mascots live in assets/mascots/ and are registered in src/media/mascots.ts. Use only existing mascot files.
- "Help me find" is a keyword search helper, not AI. Never label it AI.
- No emojis. Use the existing icon components.
- Before editing, show a short plan listing the files. After editing, list changed files and anything you couldn't verify without running the app.
## Exceptions: Lovable look (these override docs/design-system.md for the items below)
The Home top section (HomeTopSection.tsx) and all popup/sheet components (NoticeDialog.tsx, dialog.tsx) follow the Lovable reference screenshots, NOT the thin-border style in docs/design-system.md:
- Thick dark green-black outline (about 2.5dp) and a hard offset shadow (solid block, no blur; on Android use a second view behind, never elevation)
- Bright yellow #F4CD48 for the Leaves pill and the main hero button; cream #FBF6E9
- Bold display font (Bricolage Grotesque, already installed)
- Mascot in an oval on popups (yellow for success, coral for errors), about 150dp wide; the mascot may appear on error popups using the 'worry' pose
- Friendly copy is allowed in these places only (for example "Quack! Your listing's out there.")
Everything else in the app keeps following docs/design-system.md. Do NOT apply thick outlines or hard shadows anywhere else.
