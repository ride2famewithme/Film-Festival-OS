import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, ChevronRight, Clock3, Search, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isSameDay, startOfDay } from 'date-fns';
import { THEME } from '@/constants/theme';
import { films, screenings, type Film } from '@/constants/data';

const dayFilters = [
  { id: 'all', label: 'All films', offset: 0 },
  { id: 'today', label: 'Today', offset: 0 },
  { id: 'tomorrow', label: 'Tomorrow', offset: 1 },
  { id: 'day-2', label: format(new Date(Date.now() + 2 * 864e5), 'EEE'), offset: 2 },
];

export default function FilmsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeDay, setActiveDay] = useState('all');

  const featured = films.find((film) => film.premiere === 'World Premiere') ?? films[0];

  const visibleFilms = useMemo(() => {
    const selected = dayFilters.find((day) => day.id === activeDay);
    const targetDay = selected ? startOfDay(new Date(Date.now() + selected.offset * 864e5)) : null;
    return films.filter((film) => {
      const matchesQuery = `${film.title} ${film.country} ${film.director} ${film.genres.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase());
      const filmScreenings = screenings.filter((screening) => screening.filmId === film.id);
      const matchesDay = activeDay === 'all' || filmScreenings.some((screening) => isSameDay(new Date(screening.date), targetDay as Date));
      return matchesQuery && matchesDay;
    });
  }, [activeDay, query]);

  const screeningFor = (film: Film) => screenings.find((screening) => screening.filmId === film.id) ?? screenings[0];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }}
      >
        <View className="px-5">
          <View className="flex-row items-end justify-between mb-5">
            <View>
              <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">PROGRAM</Text>
              <Text className="text-title1 font-bold text-foreground mt-1">Find your next film</Text>
            </View>
            <Text className="text-footnote text-muted-foreground">{films.length} selections</Text>
          </View>

          <View className="flex-row items-center gap-3 rounded-2xl bg-card border border-border px-4 h-12 mb-4">
            <Search size={19} color={THEME.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search films, countries, directors"
              placeholderTextColor={THEME.muted}
              accessibilityLabel="Search films"
              className="flex-1 text-callout text-foreground"
              returnKeyType="search"
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}
          className="mb-6"
        >
          {dayFilters.map((day) => {
            const active = day.id === activeDay;
            return (
              <Pressable
                key={day.id}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${day.label}`}
                onPress={() => setActiveDay(day.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                className={`self-center rounded-full border px-4 py-2.5 ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
              >
                <Text className={`text-footnote font-semibold ${active ? 'text-primary-foreground' : 'text-card-foreground'}`}>{day.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={17} color={THEME.accent} />
              <Text className="text-title3 font-semibold text-foreground">Featured premiere</Text>
            </View>
            <Text className="text-caption font-semibold text-primary">NEW</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open featured film ${featured.title}`}
            onPress={() => router.push(`/films/${featured.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            className="rounded-3xl bg-card border border-border overflow-hidden mb-7"
          >
            <Image source={{ uri: featured.imageUrl }} style={{ width: '100%', height: 190 }} resizeMode="cover" accessibilityLabel={featured.alt} />
            <View className="p-4">
              <Text className="text-caption font-bold uppercase tracking-wider text-primary">{featured.premiere}</Text>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="flex-1 text-title2 font-bold text-card-foreground" numberOfLines={1}>{featured.title}</Text>
                <ChevronRight size={20} color={THEME.accent} />
              </View>
              <Text className="text-footnote text-muted-foreground mt-1">{featured.country} · {featured.year} · {featured.runtimeMinutes} min</Text>
            </View>
          </Pressable>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-title3 font-semibold text-foreground">All selections</Text>
            <Text className="text-footnote text-muted-foreground">{visibleFilms.length} shown</Text>
          </View>

          {visibleFilms.length === 0 ? (
            <View className="rounded-2xl bg-card border border-border p-6 items-center">
              <Text className="text-headline font-semibold text-card-foreground">No films found</Text>
              <Text className="text-footnote text-muted-foreground mt-1 text-center">Try another search or program day.</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {visibleFilms.map((film, index) => {
                const screening = screeningFor(film);
                const soldOut = screenings.filter((item) => item.filmId === film.id).every((item) => item.status === 'Sold out');
                return (
                  <Pressable
                    key={`${film.id}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${film.title} film details`}
                    onPress={() => router.push(`/films/${film.id}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1, width: '48%', marginBottom: 16 })}
                    className="rounded-2xl bg-card border border-border overflow-hidden"
                  >
                    <View className="relative">
                      <Image source={{ uri: film.imageUrl }} style={{ width: '100%', height: 174 }} resizeMode="cover" accessibilityLabel={film.alt} />
                      <View className="absolute top-2.5 left-2.5">
                        {soldOut ? (
                          <View className="rounded-full bg-accent px-2.5 py-1">
                            <Text className="text-caption font-bold text-accent-foreground">Sold out</Text>
                          </View>
                        ) : film.saved ? (
                          <View className="flex-row items-center gap-1 rounded-full bg-primary px-2.5 py-1">
                            <Bookmark size={11} color={THEME.accentFg} fill={THEME.accentFg} />
                            <Text className="text-caption font-bold text-primary-foreground">Saved</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View className="p-3">
                      <Text className="text-headline font-semibold text-card-foreground" numberOfLines={1}>{film.title}</Text>
                      <Text className="text-caption text-muted-foreground mt-1" numberOfLines={1}>{film.country} · {film.runtimeMinutes} min</Text>
                      <View className="flex-row items-center gap-1.5 mt-2">
                        <Clock3 size={13} color={THEME.accent} />
                        <Text className="text-caption font-medium text-primary" numberOfLines={1}>{format(new Date(screening.date), 'MMM d')} · {screening.time}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
