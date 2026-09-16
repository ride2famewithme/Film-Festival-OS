import { Image, View } from 'react-native';
import { THEME } from '../constants/theme';

// Renders the app's brand logo (set when the user picks a generated icon).
// Falls back to a neutral themed rounded square when no logo is set yet.
export function BrandLogo({ size = 72, radius }: { size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.22);
  if (!THEME.appLogo) {
    return <View style={{ width: size, height: size, borderRadius: r, backgroundColor: THEME.accent }} />;
  }
  return (
    <Image
      source={{ uri: THEME.appLogo }}
      style={{ width: size, height: size, borderRadius: r }}
      resizeMode="cover"
    />
  );
}
