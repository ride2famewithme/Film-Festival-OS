import { goWorkspaceHome } from '@/lib/navigation';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Bookmark, CheckCircle2, Clock3, MapPin, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { THEME } from '@/constants/theme';
import { films, reviews, screenings } from '@/constants/data';

export default function FilmDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const film = films.find((item) => item.id === id) ?? films[0];
  const [saved, setSaved] = useState(film.saved);

  const filmScreenings = useMemo(
    () => screenings.filter((screening) => screening.filmId === film.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [film.id],
  );
  const filmReview = reviews.find((review) => review.filmId === film.id);
  const reviewLabel = filmReview?.status ?? film.reviewStatus;

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View className="relative">
          <Image source={{ uri: film.imageUrl }} style={{ width: '100%', height: 330 }} resizeMode="cover" accessibilityLabel={film.alt} />
          <View className="absolute inset-0 bg-background/25" />
          <View className="absolute left-5 right-5 flex-row items-center justify-between" style={{ top: insets.top + 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => void goWorkspaceHome()}
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              className="w-11 h-11 rounded-full bg-background/80 items-center justify-center"
            >
              <ArrowLeft size={21} color={THEME.accent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove film from saved' : 'Save film'}
              onPress={() => setSaved((current) => !current)}
              style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              className="w-11 h-11 rounded-full bg-background/80 items-center justify-center"
            >
              <Bookmark size={20} color={THEME.accent} fill={saved ? THEME.accent : 'transparent'} />
            </Pressable>
          </View>
        </View>

        <View className="px-5 pt-5">
          <Text className="text-caption font-bold uppercase tracking-wider text-primary">{film.premiere}</Text>
          <Text className="text-display font-bold text-foreground mt-2">{film.title}</Text>
          <Text className="text-subhead text-muted-foreground mt-2">{film.country} · {film.year} · {film.runtimeMinutes} min</Text>

          <View className="flex-row flex-wrap gap-2 mt-4">
            {film.genres.map((genre, index) => (
              <View key={`${genre}-${index}`} className="rounded-full bg-muted px-3 py-1.5">
                <Text className="text-caption font-semibold text-muted-foreground">{genre}</Text>
              </View>
            ))}
          </View>

          <View className="rounded-3xl bg-card border border-border p-4 mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-title3 font-semibold text-card-foreground">Screenings</Text>
              <Text className="text-caption font-semibold text-primary">{filmScreenings.length} showings</Text>
            </View>
            <View className="gap-3">
              {filmScreenings.map((screening, index) => (
                <View key={`${screening.id}-${index}`} className="rounded-2xl bg-muted p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Clock3 size={16} color={THEME.accent} />
                      <Text className="text-headline font-semibold text-foreground">{format(new Date(screening.date), 'EEE, MMM d')} · {screening.time}</Text>
                    </View>
                    <Text className={`text-caption font-semibold ${screening.status === 'Sold out' ? 'text-accent-foreground' : 'text-primary'}`}>{screening.status}</Text>
                  </View>
                  <View className="flex-row items-center gap-2 mt-2">
                    <MapPin size={14} color={THEME.muted} />
                    <Text className="text-footnote text-muted-foreground">{screening.venue} · {screening.screen}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text className="text-title3 font-semibold text-foreground mt-7 mb-3">Synopsis</Text>
          <Text className="text-body leading-6 text-muted-foreground">{film.synopsis}</Text>

          <View className="flex-row gap-3 mt-6">
            <View className="flex-1 rounded-2xl bg-card border border-border p-4">
              <Text className="text-caption text-muted-foreground">Directed by</Text>
              <Text className="text-subhead font-semibold text-card-foreground mt-1" numberOfLines={2}>{film.director}</Text>
            </View>
            <View className="flex-1 rounded-2xl bg-card border border-border p-4">
              <Text className="text-caption text-muted-foreground">Festival year</Text>
              <Text className="text-subhead font-semibold text-card-foreground mt-1" numberOfLines={1}>{film.year} selection</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open review status for ${film.title}`}
            onPress={() => router.push('/(tabs)/reviews')}
            style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
            className="rounded-3xl bg-primary p-5 mt-6"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                {reviewLabel === 'Approved' ? <CheckCircle2 size={19} color={THEME.accentFg} /> : <Star size={19} color={THEME.accentFg} />}
                <Text className="text-title3 font-semibold text-primary-foreground">Review status</Text>
              </View>
              <Text className="text-footnote font-bold text-primary-foreground">{reviewLabel}</Text>
            </View>
            <Text className="text-footnote text-primary-foreground/80 mt-2">Open the jury workspace to inspect notes and scoring.</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
