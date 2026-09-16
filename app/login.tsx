import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Github, KeyRound, Mail, LockKeyhole } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/BrandLogo';
import { THEME } from '@/constants/theme';
import { db } from '@/data/db';
import { getActiveContext } from '@/data/session';
import { getSupabaseClient } from '@/data/supabase-client';


async function signInWithGitHub() {
  const githubClient = getSupabaseClient();
  if (!githubClient) {
    return { data: null, error: new Error('Supabase environment variables are required for GitHub sign-in.') };
  }

  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/global-hq`
      : undefined;

  return githubClient.auth.signInWithOAuth({
    provider: 'github',
    options: redirectTo ? { redirectTo } : undefined,
  });
}

const entranceImage = 'https://images.unsplash.com/photo-1627133805065-5083466be4f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NjN8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBlbnRyYW5jZSUyMGF0JTIwbmlnaHR8ZW58MXwxfHx8MTc4NjcwMTExOXww&ixlib=rb-4.1.0&q=80&w=1080';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [feedback, setFeedback] = useState('');

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      setFeedback('Enter your festival email and password to continue.');
      return;
    }

    setFeedback('Signing in…');
    const result = await db.auth.signInWithPassword({ email: email.trim(), password });

    if (result.error || !result.data) {
      setFeedback(result.error?.message ?? 'Sign-in failed.');
      return;
    }

    const context = await getActiveContext();

    if (!context) {
      await db.auth.signOut();
      setFeedback('Signed in, but no active Film Festival OS™ workspace membership was found.');
      return;
    }

    setFeedback('');

    if (context.role === 'platform_admin') {
      router.replace('/global-hq');
      return;
    }

    router.replace('/(tabs)/dashboard');
  };


  const githubSignIn = async () => {
    setFeedback('Opening GitHub secure sign-in…');
    const { error } = await signInWithGitHub();
    if (error) setFeedback(error.message);
  };

  const enterWithCode = () => {
    if (!accessCode.trim()) {
      setFeedback('Enter an access code to continue.');
      return;
    }
    setFeedback('Secure access-code redemption requires the server-side invitation workflow; it is not enabled in this build.');
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28, paddingHorizontal: 24 }}
      >
        <View className="items-center mb-6">
          <BrandLogo size={88} radius={26} />
          <Text className="text-caption font-bold uppercase tracking-widest text-primary mt-4">FILM FESTIVAL OS (TM)</Text>
        </View>

        <View className="rounded-3xl overflow-hidden border border-border mb-7">
          <Image source={{ uri: entranceImage }} style={{ width: '100%', height: 154 }} resizeMode="cover" accessibilityLabel="Cinema entrance glowing at night" />
          <View className="bg-card px-5 py-4">
            <Text className="text-title2 font-bold text-card-foreground">Your festival, in focus.</Text>
            <Text className="text-footnote text-muted-foreground mt-1">Access your program, jury reviews, and live awards board from one cinematic workspace.</Text>
          </View>
        </View>

        <Text className="text-title1 font-bold text-foreground">Welcome back</Text>
        <Text className="text-body text-muted-foreground mt-2 mb-6">Sign in with your festival credentials to continue.</Text>

        <View className="gap-4">
          <View className="flex-row items-center gap-3 rounded-2xl bg-card border border-border px-4 min-h-14">
            <Mail size={18} color={THEME.muted} />
            <TextInput
              value={email}
              onChangeText={(value) => { setEmail(value); setFeedback(''); }}
              placeholder="Festival email"
              placeholderTextColor={THEME.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Festival email"
              className="flex-1 text-callout text-foreground"
            />
          </View>

          <View className="flex-row items-center gap-3 rounded-2xl bg-card border border-border px-4 min-h-14">
            <LockKeyhole size={18} color={THEME.muted} />
            <TextInput
              value={password}
              onChangeText={(value) => { setPassword(value); setFeedback(''); }}
              placeholder="Password"
              placeholderTextColor={THEME.muted}
              secureTextEntry
              accessibilityLabel="Password"
              className="flex-1 text-callout text-foreground"
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in to Film Festival OS"
          onPress={signIn}
          style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
          className="min-h-14 rounded-2xl bg-primary flex-row items-center justify-center gap-2 mt-5"
        >
          <Text className="text-callout font-bold text-primary-foreground">Sign in</Text>
          <ArrowRight size={18} color={THEME.accentFg} />
        </Pressable>


        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with GitHub"
          onPress={githubSignIn}
          style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
          className="min-h-14 rounded-2xl border border-border bg-card flex-row items-center justify-center gap-2 mt-3"
        >
          <Github size={18} color={THEME.accent} />
          <Text className="text-callout font-bold text-card-foreground">Continue with GitHub</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use a festival access code"
          onPress={() => { setShowAccessCode((current) => !current); setFeedback(''); }}
          style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
          className="min-h-12 flex-row items-center justify-center gap-2 mt-3"
        >
          <KeyRound size={16} color={THEME.accent} />
          <Text className="text-subhead font-semibold text-primary">{showAccessCode ? 'Hide access code' : 'Use an access code'}</Text>
        </Pressable>

        {showAccessCode ? (
          <View className="rounded-2xl bg-card border border-border p-4 mt-1">
            <Text className="text-footnote text-muted-foreground mb-3">Enter the code provided by your festival administrator.</Text>
            <TextInput
              value={accessCode}
              onChangeText={(value) => { setAccessCode(value); setFeedback(''); }}
              placeholder="Access code"
              placeholderTextColor={THEME.muted}
              autoCapitalize="characters"
              accessibilityLabel="Festival access code"
              className="rounded-xl bg-background border border-border px-4 min-h-12 text-callout text-foreground"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with access code"
              onPress={enterWithCode}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              className="min-h-12 rounded-xl bg-secondary items-center justify-center mt-3"
            >
              <Text className="text-footnote font-bold text-secondary-foreground">Continue with code</Text>
            </Pressable>
          </View>
        ) : null}

        {feedback ? <Text accessibilityRole="text" className="text-footnote text-accent-foreground text-center mt-4">{feedback}</Text> : null}
        <Text className="text-caption text-muted-foreground text-center mt-8">By continuing, you agree to your festival workspace terms.</Text>
      </ScrollView>
    </View>
  );
}
