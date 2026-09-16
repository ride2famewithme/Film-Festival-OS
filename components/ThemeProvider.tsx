import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../constants/theme';

// The data-layer hooks (useTable/useRow) run react-query — an exported app has
// no other QueryClientProvider, so this scaffold-owned one is load-bearing.
// In the live preview it nests under the runtime's provider (inner wins; harmless).
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

interface ThemeProviderProps { children: React.ReactNode }

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorScheme } = useColorScheme();
  const themeVars = colorScheme === 'dark' ? darkTheme : lightTheme;

  // On web, RN Modal portals to document.body — outside any wrapper View —
  // so CSS vars set on a wrapper don't reach modal content. Apply them to
  // documentElement so they're globally available.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    const vars: Record<string, string> =
      (themeVars as any).__cssVars ?? (themeVars as Record<string, string>);
    const prev: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      prev[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, String(value));
    }
    root.classList.remove('light', 'dark');
    if (colorScheme) root.classList.add(colorScheme);
    return () => {
      for (const key of Object.keys(vars)) {
        if (prev[key]) root.style.setProperty(key, prev[key]);
        else root.style.removeProperty(key);
      }
    };
  }, [themeVars, colorScheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={themeVars} className={`${colorScheme} flex-1 bg-background`}>
        {children}
      </View>
    </QueryClientProvider>
  );
}

// Dual export — supports both `import { ThemeProvider } from '...'` (named)
// and `import ThemeProvider from '...'` (default). LLM emits both shapes.
export default ThemeProvider;
