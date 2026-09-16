# Film Festival OS (TM)

Generated with [ShipNative](https://shipnative.com).

## Tech stack

Expo 54 · React Native 0.81 · Expo Router 6 · NativeWind 4 · TypeScript · lucide-react-native

## File locations

| Type | Location | Export |
| --- | --- | --- |
| Screens | `app/**/*.tsx` | default |
| Tab layout | `app/(tabs)/_layout.tsx` | default |
| Components | `components/*.tsx` | named |
| Theme tokens | `constants/theme.ts`, `tailwind.config.js` | — |

## Rules

- Style with NativeWind `className` — never `StyleSheet.create()`.
- Use semantic tokens (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`) — never hardcode colors.
- Images: `Image` from `react-native` (not `expo-image`).
- Read safe-area insets via `useSafeAreaInsets()`; do not hardcode tab-bar padding.
- The runtime owns dependencies — do not pin react / react-native / expo versions.

## Layout patterns

Compose screens from these blocks — lead with imagery, vary section types, never stack identical list rows.

- **Section header**: row with `text-xl font-bold text-foreground` title + a `text-primary` "See all" pressable on the right.
- **Horizontal carousel**: `<FlatList horizontal showsHorizontalScrollIndicator={false}>` of `w-40` cards (cover image `aspect-square rounded-2xl`, title, subtitle).
- **Media list row**: `flex-row items-center gap-3` — `w-14 h-14 rounded-xl` thumbnail, title/subtitle column, trailing icon.
- **Hero header**: full-bleed image or `bg-primary` block with overlaid title + primary CTA.
- **Stats row**: 2–3 `bg-card rounded-2xl p-4` tiles in a `flex-row gap-3`, big number + label.
- **Featured grid**: 2-col grid of `bg-card rounded-2xl` cards for highlights.

Rules: surfaces are `bg-card rounded-2xl`; every screen has ≥1 `bg-primary` CTA; no `border-foreground` hairlines; icon color via `THEME.accent`.

## Run

```bash
npm install
npx expo start
```
