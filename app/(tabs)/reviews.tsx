import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronRight, CircleAlert, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { films, reviews, type Review } from '@/constants/data';

type ReviewStatus = Review['status'];

const filters: ReviewStatus[] = ['Needs review', 'In progress', 'Approved'];

export default function AIReviewsScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<ReviewStatus>('Needs review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewStatus>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const reviewItems = useMemo(() => reviews.map((review) => ({
    ...review,
    currentStatus: reviewStates[review.id] ?? review.status,
    currentNotes: reviewNotes[review.id] ?? review.humanNotes,
  })), [reviewNotes, reviewStates]);

  const visibleReviews = reviewItems.filter((review) => review.currentStatus === activeFilter);
  const activeReview = reviewItems.find((review) => review.id === selectedId) ?? reviewItems[0];
  const filmFor = (filmId: string) => films.find((film) => film.id === filmId) ?? films[0];
  const awaitingCount = reviewItems.filter((review) => review.currentStatus === 'Needs review').length;
  const averageScore = Math.round(reviewItems.reduce((sum, review) => sum + review.overallScore, 0) / Math.max(reviewItems.length, 1));

  const updateStatus = (status: ReviewStatus) => {
    if (!activeReview) return;
    setReviewStates((current) => ({ ...current, [activeReview.id]: status }));
    setSelectedId(null);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: 20 }}
      >
        <View className="flex-row items-end justify-between mb-6">
          <View>
            <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">JURY WORKSPACE</Text>
            <Text className="text-title1 font-bold text-foreground mt-1">AI Reviews</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-accent px-3 py-1.5">
            <Sparkles size={13} color={THEME.accentFg} />
            <Text className="text-caption font-bold text-accent-foreground">ASSISTED</Text>
          </View>
        </View>

        <View className="rounded-3xl bg-card border border-border p-5 mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-title3 font-semibold text-card-foreground">Your review queue</Text>
              <Text className="text-footnote text-muted-foreground mt-1">AI has prepared a first pass for every selected film.</Text>
            </View>
            <View className="w-20 h-20 rounded-full border-4 border-primary items-center justify-center">
              <Text className="text-title2 font-bold text-primary" numberOfLines={1}>{averageScore}</Text>
              <Text className="text-caption text-muted-foreground">avg score</Text>
            </View>
          </View>
          <View className="flex-row items-end justify-between mt-5">
            <View>
              <Text className="text-display font-bold text-foreground" numberOfLines={1}>{awaitingCount}</Text>
              <Text className="text-footnote text-muted-foreground">films need your review</Text>
            </View>
            <View className="items-end">
              <Text className="text-caption text-muted-foreground">AI confidence</Text>
              <Text className="text-headline font-semibold text-primary" numberOfLines={1}>{Math.round(reviewItems.reduce((sum, review) => sum + review.confidence, 0) / Math.max(reviewItems.length, 1))}%</Text>
            </View>
          </View>
          <View className="h-2 rounded-full bg-muted overflow-hidden mt-4">
            <View className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, (averageScore / 100) * 100))}%` }} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          className="mb-5"
        >
          {filters.map((filter) => {
            const active = filter === activeFilter;
            const count = reviewItems.filter((review) => review.currentStatus === filter).length;
            return (
              <Pressable
                key={filter}
                accessibilityRole="button"
                accessibilityLabel={`Show ${filter} reviews`}
                onPress={() => setActiveFilter(filter)}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                className={`self-center flex-row items-center gap-2 rounded-full border px-3.5 py-2.5 ${active ? 'bg-primary border-primary' : 'bg-card border-border'}`}
              >
                <Text className={`text-footnote font-semibold ${active ? 'text-primary-foreground' : 'text-card-foreground'}`}>{filter}</Text>
                <View className={`min-w-5 rounded-full px-1.5 py-0.5 items-center ${active ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                  <Text className={`text-caption font-bold ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-title3 font-semibold text-foreground">{activeFilter}</Text>
          <Text className="text-footnote text-muted-foreground">Tap to inspect</Text>
        </View>
        <View className="gap-3">
          {visibleReviews.length === 0 ? (
            <View className="rounded-2xl bg-card border border-border p-6 items-center">
              <Check size={24} color={THEME.accent} />
              <Text className="text-headline font-semibold text-card-foreground mt-2">Queue is clear</Text>
              <Text className="text-footnote text-muted-foreground mt-1 text-center">There are no reviews in this state.</Text>
            </View>
          ) : visibleReviews.map((review, index) => {
            const film = filmFor(review.filmId);
            return (
              <Pressable
                key={`${review.id}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Open review for ${film.title}`}
                onPress={() => setSelectedId(review.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}
                className="flex-row items-center gap-3 rounded-2xl bg-card border border-border p-3"
              >
                <Image source={{ uri: film.imageUrl }} style={{ width: 62, height: 76 }} resizeMode="cover" className="rounded-xl" accessibilityLabel={film.alt} />
                <View className="flex-1 min-w-0">
                  <Text className="text-headline font-semibold text-card-foreground" numberOfLines={1}>{film.title}</Text>
                  <Text className="text-footnote text-muted-foreground mt-1" numberOfLines={1}>{review.reviewer} · {review.currentStatus}</Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <View className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <View className="h-full rounded-full bg-primary" style={{ width: `${review.confidence}%` }} />
                    </View>
                    <Text className="text-caption font-semibold text-primary" numberOfLines={1}>{review.confidence}%</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={THEME.muted} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedId)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.62)' }}>
          {activeReview ? (
            <View className="bg-card rounded-t-3xl border-t border-border px-5" style={{ paddingTop: 18, paddingBottom: Math.max(insets.bottom, 18) }}>
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Sparkles size={18} color={THEME.accent} />
                  <Text className="text-title3 font-semibold text-card-foreground">Review workspace</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close review workspace" onPress={() => setSelectedId(null)} className="w-11 h-11 items-center justify-center">
                  <X size={22} color={THEME.muted} />
                </Pressable>
              </View>
              <Text className="text-title2 font-bold text-card-foreground" numberOfLines={1}>{filmFor(activeReview.filmId).title}</Text>
              <Text className="text-footnote text-muted-foreground mt-1">Reviewer: {activeReview.reviewer} · AI confidence {activeReview.confidence}%</Text>
              <View className="rounded-2xl bg-muted p-4 mt-4">
                <Text className="text-subhead font-semibold text-foreground">AI highlights</Text>
                {activeReview.aiHighlights.map((highlight, index) => (
                  <View key={`${activeReview.id}-highlight-${index}`} className="flex-row items-start gap-2 mt-2">
                    <CircleAlert size={15} color={THEME.accent} />
                    <Text className="flex-1 text-footnote text-muted-foreground">{highlight}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-subhead font-semibold text-card-foreground mt-4 mb-2">Human notes</Text>
              <TextInput
                value={activeReview.currentNotes}
                onChangeText={(value) => setReviewNotes((current) => ({ ...current, [activeReview.id]: value }))}
                placeholder="Add your jury notes..."
                placeholderTextColor={THEME.muted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Human review notes"
                className="min-h-20 rounded-2xl bg-background border border-border px-4 py-3 text-callout text-foreground"
              />
              <View className="flex-row gap-3 mt-4">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Request changes to this review"
                  onPress={() => updateStatus('Needs review')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                  className="flex-1 min-h-12 rounded-2xl border border-border items-center justify-center flex-row gap-2"
                >
                  <RotateCcw size={16} color={THEME.muted} />
                  <Text className="text-footnote font-semibold text-card-foreground">Request changes</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Approve this review"
                  onPress={() => updateStatus('Approved')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
                  className="flex-1 min-h-12 rounded-2xl bg-primary items-center justify-center flex-row gap-2"
                >
                  <Check size={17} color={THEME.accentFg} />
                  <Text className="text-footnote font-bold text-primary-foreground">Approve</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
