import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';

import {
  getAssignedScoringForm,
  getOrCreateDraftJuryReview,
  listCriterionScores,
  listMyJuryAssignments,
  saveCriterionScore,
  submitCriterionJuryReview,
} from '@/data/workflows/festival-core';


export default function JuryWorkflow() {
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<any[]>([]);

  const [activeAssignment, setActiveAssignment] =
    useState<any | null>(null);

  const [review, setReview] =
    useState<any | null>(null);

  const [scoringForm, setScoringForm] =
    useState<any | null>(null);

  const [criteria, setCriteria] =
    useState<any[]>([]);

  const [savedScores, setSavedScores] =
    useState<any[]>([]);

  const [scores, setScores] =
    useState<Record<string, string>>({});

  const [comments, setComments] =
    useState<Record<string, string>>({});

  const [recommendation, setRecommendation] =
    useState('');

  const [notes, setNotes] =
    useState('');


  async function load() {
    try {
      setRows(await listMyJuryAssignments());
    } catch (e: any) {
      Alert.alert('Jury queue', e.message);
    }
  }


  useEffect(() => {
    void load();
  }, []);


  async function openAssignment(row: any) {
    try {
      const assigned = await getAssignedScoringForm(row.id);

      const draftReview = await getOrCreateDraftJuryReview(
        row.id,
        row.submission_id
      );

      if (draftReview.status !== 'draft') {
        Alert.alert(
          'Jury Review',
          'This review has already been submitted.'
        );
        return;
      }

      const existingScores = await listCriterionScores(
        draftReview.id
      );

      const nextScores: Record<string, string> = {};
      const nextComments: Record<string, string> = {};

      for (const saved of existingScores) {
        nextScores[String(saved.criterion_id)] =
          String(saved.raw_score ?? '');

        nextComments[String(saved.criterion_id)] =
          String(saved.criterion_comment ?? '');
      }

      setActiveAssignment(row);
      setReview(draftReview);
      setScoringForm(assigned.form);
      setCriteria(assigned.criteria);
      setSavedScores(existingScores);

      setScores(nextScores);
      setComments(nextComments);

      setRecommendation(
        String(draftReview.recommendation ?? '')
      );

      setNotes(
        String(draftReview.notes ?? '')
      );

    } catch (e: any) {
      Alert.alert('Jury Review', e.message);
    }
  }


  const draftPreviewScore = useMemo(() => {
    return savedScores.reduce(
      (sum, row) =>
        sum + Number(row.weighted_contribution || 0),
      0
    );
  }, [savedScores]);


  async function saveOneCriterion(criterion: any) {
    if (!review || !activeAssignment || !scoringForm) {
      return;
    }

    const key = String(criterion.id);

    const raw = Number(scores[key]);

    const min = Number(criterion.score_min ?? 0);
    const max = Number(criterion.score_max ?? 100);

    if (
      !Number.isFinite(raw) ||
      raw < min ||
      raw > max
    ) {
      Alert.alert(
        'Criterion Score',
        `Use a score between ${min} and ${max}.`
      );
      return;
    }

    try {
      await saveCriterionScore({
        reviewId: review.id,
        assignmentId: activeAssignment.id,
        scoringFormId: scoringForm.id,
        criterionId: criterion.id,
        rawScore: raw,
        comment: comments[key] || '',
      });

      const refreshed = await listCriterionScores(
        review.id
      );

      setSavedScores(refreshed);

      Alert.alert(
        'Saved',
        `${criterion.label} saved.`
      );

    } catch (e: any) {
      Alert.alert('Criterion Score', e.message);
    }
  }


  async function submitFinalReview() {
    if (!review) return;

    try {
      await submitCriterionJuryReview(
        review.id,
        recommendation,
        notes
      );

      Alert.alert(
        'Submitted',
        'Final jury review submitted successfully.'
      );

      setActiveAssignment(null);
      setReview(null);
      setScoringForm(null);
      setCriteria([]);
      setSavedScores([]);
      setScores({});
      setComments({});
      setRecommendation('');
      setNotes('');

      await load();

    } catch (e: any) {
      console.error('FINAL REVIEW SUBMIT ERROR:', e);
      if (typeof globalThis !== 'undefined' && (globalThis as any).alert) {
        (globalThis as any).alert('FINAL REVIEW ERROR: ' + (e?.message || String(e)));
      } else {
        Alert.alert('Final Review', e?.message || String(e));
      }
    }
  }


  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >

        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft
            color={THEME.accent}
            size={19}
          />
        </Pressable>


        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          PRIVATE JURY
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          My Review Queue
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Assigned scoring forms, criterion scoring and database-controlled final submission.
        </Text>


        <Pressable
          onPress={load}
          className="self-end mb-3"
        >
          <RefreshCw
            size={19}
            color={THEME.accent}
          />
        </Pressable>


        {rows.map((row) => (
          <View
            key={row.id}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >

            <Text className="text-headline font-semibold text-card-foreground">
              Submission {row.submission_id}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Assignment: {String(row.status).toUpperCase()}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Scoring Form:{' '}
              {row.scoring_form_id
                ? 'ASSIGNED'
                : 'NOT ASSIGNED'}
            </Text>


            {row.status === 'assigned' && (
              <Pressable
                onPress={() => openAssignment(row)}
                className="rounded-xl border border-primary px-4 py-3 mt-3 items-center"
              >
                <Text className="font-bold text-primary">
                  Open Jury Scorecard
                </Text>
              </Pressable>
            )}

          </View>
        ))}


        {rows.length === 0 && (
          <View className="rounded-2xl border border-border bg-card p-6">
            <Text className="text-card-foreground font-semibold">
              No assigned reviews
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Assignments appear here only for a user with the juror role.
            </Text>
          </View>
        )}


        {activeAssignment && review && scoringForm && (
          <View className="rounded-2xl border border-primary bg-card p-4 mt-5">

            <Text className="text-title3 font-bold text-card-foreground">
              {scoringForm.name}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Version {scoringForm.version} ·{' '}
              {String(scoringForm.template_family || '').replace(/_/g, ' ')} ·{' '}
              {String(scoringForm.division_key || 'open')}
            </Text>


            <Text className="text-headline font-semibold text-card-foreground mt-5">
              Scoring Criteria
            </Text>


            {criteria.map((criterion) => {
              const key = String(criterion.id);

              const saved = savedScores.find(
                (row) =>
                  String(row.criterion_id) === key
              );

              return (
                <View
                  key={criterion.id}
                  className="rounded-xl border border-border bg-background p-3 mt-3"
                >

                  <Text className="font-semibold text-foreground">
                    {criterion.label}
                  </Text>

                  <Text className="text-footnote text-muted-foreground mt-1">
                    Weight: {criterion.weight_percent}% · Score:{' '}
                    {criterion.score_min}–{criterion.score_max}
                    {criterion.comment_required
                      ? ' · Comment REQUIRED'
                      : ''}
                  </Text>


                  <TextInput
                    value={scores[key] || ''}
                    onChangeText={(value) =>
                      setScores((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                    keyboardType="numeric"
                    placeholder={`Score ${criterion.score_min}–${criterion.score_max}`}
                    placeholderTextColor={THEME.muted}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-foreground mt-3"
                  />


                  <TextInput
                    value={comments[key] || ''}
                    onChangeText={(value) =>
                      setComments((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                    multiline
                    placeholder={
                      criterion.comment_required
                        ? 'Required juror comment'
                        : 'Juror comment'
                    }
                    placeholderTextColor={THEME.muted}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-foreground mt-2 min-h-20"
                  />


                  <Pressable
                    onPress={() =>
                      saveOneCriterion(criterion)
                    }
                    className="rounded-xl border border-primary px-4 py-3 mt-3 items-center"
                  >
                    <Text className="font-bold text-primary">
                      {saved
                        ? 'Update Criterion'
                        : 'Save Criterion'}
                    </Text>
                  </Pressable>


                  {saved && (
                    <Text className="text-footnote text-muted-foreground mt-2">
                      Saved · Weighted contribution:{' '}
                      {Number(
                        saved.weighted_contribution || 0
                      ).toFixed(2)}
                    </Text>
                  )}

                </View>
              );
            })}


            <View className="rounded-xl border border-border bg-background p-4 mt-4">

              <Text className="font-semibold text-foreground">
                Draft Score Preview
              </Text>

              <Text className="text-title2 font-bold text-primary mt-1">
                {draftPreviewScore.toFixed(2)} / 100
              </Text>

              <Text className="text-footnote text-muted-foreground mt-1">
                Preview only. Supabase calculates the official final score at submission.
              </Text>

            </View>


            <TextInput
              value={recommendation}
              onChangeText={setRecommendation}
              placeholder="Recommendation"
              placeholderTextColor={THEME.muted}
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mt-4"
            />


            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Overall juror notes"
              placeholderTextColor={THEME.muted}
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mt-2 min-h-24"
            />


            <Pressable
              onPress={submitFinalReview}
              className="rounded-xl bg-primary px-4 py-3 mt-4 flex-row justify-center items-center gap-2"
            >
              <ClipboardCheck
                size={17}
                color={THEME.primaryFg}
              />

              <Text className="font-bold text-primary-foreground">
                Submit Final Review
              </Text>
            </Pressable>

          </View>
        )}

      </ScrollView>
    </View>
  );
}
