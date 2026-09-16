import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { THEME } from '../constants/theme';
import { BrandLogo } from './BrandLogo';

// Branded starting screen: shows the app logo centered for ~1.2s on mount,
// then reveals the app. No-op (renders children immediately) when no logo set.
export function BrandSplash({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(!THEME.appLogo);
  useEffect(() => {
    if (!THEME.appLogo) return;
    const t = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(t);
  }, []);
  if (done) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.bg }}>
      <BrandLogo size={96} />
    </View>
  );
}
