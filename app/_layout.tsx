import { Stack } from 'expo-router';
import { ThemeProvider } from '@/components/ThemeProvider';
import { BrandSplash } from '@/components/BrandSplash';
import '../global.css';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <BrandSplash>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="films/[id]" />
        </Stack>
      </BrandSplash>
    </ThemeProvider>
  );
}
