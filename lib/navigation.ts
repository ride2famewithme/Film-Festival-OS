import { router } from 'expo-router';
import { getActiveContext } from '@/data/session';

export async function goWorkspaceHome() {
  try {
    const context = await getActiveContext();

    switch (context?.role) {
      case 'platform_admin':
        router.replace('/global-hq');
        return;

      case 'juror':
        router.replace('/jury');
        return;

      case 'creator':
        router.replace('/creator');
        return;

      case 'sponsor_partner':
        router.replace('/sponsor');
        return;

      default:
        router.replace('/(tabs)/dashboard');
        return;
    }
  } catch {
    router.replace('/(tabs)/dashboard');
  }
}
