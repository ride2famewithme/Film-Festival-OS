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
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RefreshCw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import {
  activateScoringForm,
  addScoringCriterion,
  createScoringForm,
  deleteScoringCriterion,
  type ScoringTemplateFamily,
  listScoringCriteria,
  listScoringForms,
  updateScoringCriterion,
} from '@/data/workflows/jury-scoring-forms';

const SCORING_TEMPLATE_FAMILIES: {
  value: ScoringTemplateFamily;
  label: string;
}[] = [
  { value: 'general_film', label: 'General Film' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'ai_film', label: 'AI Film' },
  { value: 'drone_film', label: 'Drone / Aerial' },
  { value: 'screenplay', label: 'Screenplay / Script' },
  { value: 'animation_2d', label: '2D Animation' },
  { value: 'animation_3d', label: '3D Animation' },
  { value: 'original_score', label: 'Original Score / Music' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'sound_sfx', label: 'Sound / SFX' },
  { value: 'custom', label: 'Custom' },
];


function scoringTemplateFamilyLabel(value: unknown) {
  const key = String(value || 'general_film');

  return (
    SCORING_TEMPLATE_FAMILIES.find((item) => item.value === key)?.label ||
    key.replace(/_/g, ' ')
  );
}

const STANDARD_FILM_CRITERIA = [
  { label: 'Story & Screenplay', weightPercent: 25, commentRequired: true },
  { label: 'Direction', weightPercent: 20, commentRequired: true },
  { label: 'Acting / Performance', weightPercent: 15, commentRequired: true },
  { label: 'Cinematography', weightPercent: 15, commentRequired: true },
  { label: 'Editing', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 5, commentRequired: true },
  { label: 'Originality / Impact', weightPercent: 10, commentRequired: true },
];


const STANDARD_SCREENPLAY_CRITERIA = [
  { label: 'Premise / Concept / Originality', weightPercent: 10, commentRequired: true },
  { label: 'Structure & Narrative Construction', weightPercent: 15, commentRequired: true },
  { label: 'Character Development', weightPercent: 15, commentRequired: true },
  { label: 'Dialogue', weightPercent: 10, commentRequired: true },
  { label: 'Pacing', weightPercent: 10, commentRequired: true },
  { label: 'Visual / Cinematic Storytelling', weightPercent: 10, commentRequired: true },
  { label: 'Screenwriting Craft & Format', weightPercent: 10, commentRequired: true },
  { label: 'Theme / Emotional Impact', weightPercent: 10, commentRequired: true },
  { label: 'Scope & Execution', weightPercent: 5, commentRequired: true },
  { label: 'Development / Producer EOI Potential', weightPercent: 5, commentRequired: true },
];


const STANDARD_DOCUMENTARY_CRITERIA = [
  { label: 'Research & Subject Understanding', weightPercent: 15, commentRequired: true },
  { label: 'Narrative Clarity & Structure', weightPercent: 15, commentRequired: true },
  { label: 'Authenticity & Integrity', weightPercent: 15, commentRequired: true },
  { label: 'Access / Interviews / Evidence', weightPercent: 10, commentRequired: true },
  { label: 'Editorial Construction', weightPercent: 15, commentRequired: true },
  { label: 'Cinematography / Visual Language', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 10, commentRequired: true },
  { label: 'Impact / Relevance', weightPercent: 10, commentRequired: true },
];

const STANDARD_AI_FILM_CRITERIA = [
  { label: 'Concept / Story / Purpose', weightPercent: 15, commentRequired: true },
  { label: 'Human Creative Direction', weightPercent: 15, commentRequired: true },
  { label: 'Narrative / Visual Coherence', weightPercent: 15, commentRequired: true },
  { label: 'Visual Consistency', weightPercent: 15, commentRequired: true },
  { label: 'Technical / Artifact Control', weightPercent: 15, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 10, commentRequired: true },
  { label: 'Originality / Creative Use', weightPercent: 10, commentRequired: true },
  { label: 'Disclosure / Provenance', weightPercent: 5, commentRequired: true },
];

const STANDARD_DRONE_FILM_CRITERIA = [
  { label: 'Aerial Composition', weightPercent: 15, commentRequired: true },
  { label: 'Movement / Flight Fluidity', weightPercent: 15, commentRequired: true },
  { label: 'Shot Planning / Coverage', weightPercent: 10, commentRequired: true },
  { label: 'Visual Storytelling', weightPercent: 15, commentRequired: true },
  { label: 'Image Quality', weightPercent: 15, commentRequired: true },
  { label: 'Editing / Rhythm', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 10, commentRequired: true },
  { label: 'Originality / Impact', weightPercent: 10, commentRequired: true },
];


const STANDARD_ANIMATION_2D_CRITERIA = [
  { label: 'Visual Design / Art Direction', weightPercent: 15, commentRequired: true },
  { label: 'Animation Principles / Movement', weightPercent: 15, commentRequired: true },
  { label: 'Character Performance', weightPercent: 15, commentRequired: true },
  { label: 'Timing / Rhythm', weightPercent: 10, commentRequired: true },
  { label: 'Storytelling / Narrative Clarity', weightPercent: 15, commentRequired: true },
  { label: 'Backgrounds / Compositing', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 10, commentRequired: true },
  { label: 'Originality / Impact', weightPercent: 10, commentRequired: true },
];

const STANDARD_ANIMATION_3D_CRITERIA = [
  { label: 'Modeling / Visual Design', weightPercent: 15, commentRequired: true },
  { label: 'Rigging / Character Performance', weightPercent: 15, commentRequired: true },
  { label: 'Animation / Movement', weightPercent: 15, commentRequired: true },
  { label: 'Lighting / Rendering', weightPercent: 15, commentRequired: true },
  { label: 'Texturing / Materials', weightPercent: 10, commentRequired: true },
  { label: 'Cinematography / Composition', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Music', weightPercent: 10, commentRequired: true },
  { label: 'Originality / Impact', weightPercent: 10, commentRequired: true },
];


const STANDARD_ORIGINAL_SCORE_CRITERIA = [
  { label: 'Composition & Musical Craft', weightPercent: 20, commentRequired: true },
  { label: 'Originality & Musical Identity', weightPercent: 15, commentRequired: true },
  { label: 'Emotional / Dramatic Effectiveness', weightPercent: 15, commentRequired: true },
  { label: 'Thematic Development', weightPercent: 15, commentRequired: true },
  { label: 'Arrangement / Orchestration', weightPercent: 10, commentRequired: true },
  { label: 'Rhythm / Pacing / Musical Flow', weightPercent: 10, commentRequired: true },
  { label: 'Production / Mix Quality', weightPercent: 10, commentRequired: true },
  { label: 'Overall Impact', weightPercent: 5, commentRequired: true },
];

const STANDARD_MUSIC_VIDEO_CRITERIA = [
  { label: 'Music / Visual Relationship', weightPercent: 20, commentRequired: true },
  { label: 'Direction', weightPercent: 15, commentRequired: true },
  { label: 'Concept / Creative Vision', weightPercent: 15, commentRequired: true },
  { label: 'Performance / Choreography', weightPercent: 10, commentRequired: true },
  { label: 'Cinematography / Animation', weightPercent: 15, commentRequired: true },
  { label: 'Editing / Rhythm', weightPercent: 10, commentRequired: true },
  { label: 'Sound / Technical Presentation', weightPercent: 5, commentRequired: true },
  { label: 'Originality / Impact', weightPercent: 10, commentRequired: true },
];

const STANDARD_SOUND_SFX_CRITERIA = [
  { label: 'Creativity / Sound Concept', weightPercent: 15, commentRequired: true },
  { label: 'Appropriateness / Dramatic Fit', weightPercent: 15, commentRequired: true },
  { label: 'Layering / Detail', weightPercent: 15, commentRequired: true },
  { label: 'Spatial Design / Environment', weightPercent: 10, commentRequired: true },
  { label: 'Synchronization / Timing', weightPercent: 10, commentRequired: true },
  { label: 'Dynamics / Clarity', weightPercent: 10, commentRequired: true },
  { label: 'Technical Quality', weightPercent: 10, commentRequired: true },
  { label: 'Storytelling Contribution / Impact', weightPercent: 15, commentRequired: true },
];

const SCORING_TEMPLATE_PRESETS = {
  general_film: {
    label: 'General Film Assessment™',
    criteria: STANDARD_FILM_CRITERIA,
  },
  screenplay: {
    label: 'Screenplay Assessment™',
    criteria: STANDARD_SCREENPLAY_CRITERIA,
  },
  documentary: {
    label: 'Documentary Assessment™',
    criteria: STANDARD_DOCUMENTARY_CRITERIA,
  },
  ai_film: {
    label: 'AI Film Assessment™',
    criteria: STANDARD_AI_FILM_CRITERIA,
  },
  drone_film: {
    label: 'Drone / Aerial Assessment™',
    criteria: STANDARD_DRONE_FILM_CRITERIA,
  },
  animation_2d: {
    label: '2D Animation Assessment™',
    criteria: STANDARD_ANIMATION_2D_CRITERIA,
  },
  animation_3d: {
    label: '3D Animation Assessment™',
    criteria: STANDARD_ANIMATION_3D_CRITERIA,
  },
  original_score: {
    label: 'Original Score / Music Assessment™',
    criteria: STANDARD_ORIGINAL_SCORE_CRITERIA,
  },
  music_video: {
    label: 'Music Video Assessment™',
    criteria: STANDARD_MUSIC_VIDEO_CRITERIA,
  },
  sound_sfx: {
    label: 'Sound / SFX Assessment™',
    criteria: STANDARD_SOUND_SFX_CRITERIA,
  },
} as const;

export default function JuryScoringForms() {
  const insets = useSafeAreaInsets();

  const [forms, setForms] = useState<any[]>([]);
  const [selectedForm, setSelectedForm] = useState<any | null>(null);
  const [criteria, setCriteria] = useState<any[]>([]);

  const [formName, setFormName] = useState('');
  const [templateFamily, setTemplateFamily] =
    useState<ScoringTemplateFamily>('general_film');
  const [divisionKey, setDivisionKey] = useState('open');
  const [criterionName, setCriterionName] = useState('');
  const [weight, setWeight] = useState('');
  const [commentRequired, setCommentRequired] = useState(false);

  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editCommentRequired, setEditCommentRequired] = useState(false);

  const totalWeight = useMemo(
    () =>
      criteria.reduce(
        (sum, row) => sum + Number(row.weight_percent || 0),
        0
      ),
    [criteria]
  );

  const remainingWeight = Math.max(0, 100 - totalWeight);

  async function loadForms() {
    try {
      setForms(await listScoringForms());
    } catch (e: any) {
      Alert.alert('Scoring Forms', e.message);
    }
  }

  async function openForm(form: any) {
    try {
      setSelectedForm(form);
      setCriteria(await listScoringCriteria(form.id));
    } catch (e: any) {
      Alert.alert('Scoring Form', e.message);
    }
  }

  useEffect(() => {
    void loadForms();
  }, []);

  async function createForm() {
    try {
      await createScoringForm(formName, {
        templateFamily,
        divisionKey,
      });
      setFormName('');
      await loadForms();
      Alert.alert('Created', 'Draft scoring form created.');
    } catch (e: any) {
      Alert.alert('Scoring Form', e.message);
    }
  }

  async function addCriterion() {
    if (!selectedForm) {
      Alert.alert('Scoring Form', 'Select a draft scoring form first.');
      return;
    }

    const n = Number(weight);

    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      Alert.alert('Weight', 'Use a percentage between 1 and 100.');
      return;
    }

    if (n > remainingWeight) {
      Alert.alert(
        'Weight Allocation',
        `Only ${remainingWeight}% remains available.`
      );
      return;
    }

    try {
      await addScoringCriterion({
        formId: selectedForm.id,
        label: criterionName,
        weightPercent: n,
        commentRequired,
        sortOrder: criteria.length + 1,
      });

      setCriterionName('');
      setWeight('');
      setCommentRequired(false);

      await openForm(selectedForm);
    } catch (e: any) {
      Alert.alert('Criterion', e.message);
    }
  }

  function beginCriterionEdit(row: any) {
    setEditingCriterionId(String(row.id));
    setEditName(String(row.label ?? ''));
    setEditWeight(String(row.weight_percent ?? ''));
    setEditCommentRequired(Boolean(row.comment_required));
  }

  function cancelCriterionEdit() {
    setEditingCriterionId(null);
    setEditName('');
    setEditWeight('');
    setEditCommentRequired(false);
  }

  async function saveCriterionEdit(row: any) {
    const n = Number(editWeight);

    if (!editName.trim()) {
      Alert.alert('Criterion', 'Criterion name is required.');
      return;
    }

    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      Alert.alert('Weight', 'Use a percentage between 1 and 100.');
      return;
    }

    const otherWeight =
      totalWeight - Number(row.weight_percent || 0);

    const maximumForThisCriterion = 100 - otherWeight;

    if (n > maximumForThisCriterion) {
      Alert.alert(
        'Weight Allocation',
        `This criterion can use a maximum of ${maximumForThisCriterion}% without exceeding 100%.`
      );
      return;
    }

    try {
      await updateScoringCriterion(String(row.id), {
        label: editName,
        weightPercent: n,
        commentRequired: editCommentRequired,
      });

      cancelCriterionEdit();

      if (selectedForm) {
        await openForm(selectedForm);
      }
    } catch (e: any) {
      Alert.alert('Criterion', e.message);
    }
  }

  function confirmDeleteCriterion(row: any) {
    Alert.alert(
      'Delete Criterion',
      `Remove "${row.label}" from this draft scoring form?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScoringCriterion(String(row.id));

              if (editingCriterionId === String(row.id)) {
                cancelCriterionEdit();
              }

              if (selectedForm) {
                await openForm(selectedForm);
              }
            } catch (e: any) {
              Alert.alert('Criterion', e.message);
            }
          },
        },
      ]
    );
  }

  async function loadStandardAssessmentPreset() {
    if (!selectedForm) {
      Alert.alert('Scoring Form', 'Select a draft scoring form first.');
      return;
    }

    if (selectedForm.status !== 'draft') {
      Alert.alert('Scoring Form', 'Only draft forms can be modified.');
      return;
    }

    const family = String(selectedForm.template_family || 'general_film');
    const preset =
      SCORING_TEMPLATE_PRESETS[
        family as keyof typeof SCORING_TEMPLATE_PRESETS
      ];

    if (!preset) {
      Alert.alert(
        'Standard Template',
        'A standard preset for this Template Family has not been added yet.'
      );
      return;
    }

    const existingLabels = new Set(
      criteria.map((row) =>
        String(row.label || '').trim().toLowerCase()
      )
    );

    const missing = preset.criteria.filter(
      (item) => !existingLabels.has(item.label.toLowerCase())
    );

    if (missing.length === 0) {
      Alert.alert(
        'Standard Template',
        `All standard ${preset.label} criteria are already present.`
      );
      return;
    }

    const missingWeight = missing.reduce(
      (sum, item) => sum + item.weightPercent,
      0
    );

    if (totalWeight + missingWeight > 100) {
      Alert.alert(
        'Standard Template',
        `The missing standard criteria require ${missingWeight}%, but only ${remainingWeight}% remains.`
      );
      return;
    }

    try {
      for (let index = 0; index < missing.length; index += 1) {
        const item = missing[index];

        await addScoringCriterion({
          formId: selectedForm.id,
          label: item.label,
          weightPercent: item.weightPercent,
          commentRequired: item.commentRequired,
          sortOrder: criteria.length + index + 1,
        });
      }

      await openForm(selectedForm);

      Alert.alert(
        'Standard Template Loaded',
        `${preset.label}: ${missing.length} missing criterion/criteria added.`
      );
    } catch (e: any) {
      Alert.alert('Standard Template', e.message);
    }
  }

  async function activateForm() {
    if (!selectedForm) return;

    if (totalWeight !== 100) {
      Alert.alert(
        'Cannot Activate',
        `Criterion weights currently total ${totalWeight}%. They must total exactly 100%.`
      );
      return;
    }

    try {
      await activateScoringForm(selectedForm.id);
      await loadForms();

      const updated = {
        ...selectedForm,
        status: 'active',
      };

      setSelectedForm(updated);

      Alert.alert(
        'Activated',
        'Scoring form is now active and locked for competition use.'
      );
    } catch (e: any) {
      Alert.alert('Scoring Form', e.message);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-border bg-card items-center justify-center mb-5"
        >
          <ArrowLeft color={THEME.accent} size={19} />
        </Pressable>

        <Text className="text-footnote font-semibold uppercase tracking-widest text-primary">
          JURY GOVERNANCE
        </Text>

        <Text className="text-title1 font-bold text-foreground mt-1">
          Scoring Forms™
        </Text>

        <Text className="text-subhead text-muted-foreground mt-1 mb-5">
          Versioned scoring criteria, weights, required comments and controlled activation.
        </Text>

        <View className="rounded-2xl border border-border bg-card p-4 mb-5">
          <Text className="text-headline font-semibold text-card-foreground mb-3">
            Create Scoring Form
          </Text>

          <TextInput
            value={formName}
            onChangeText={setFormName}
            placeholder="Example: Film Assessment"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Text className="text-footnote font-semibold text-foreground mt-4 mb-2">
            Template Family
          </Text>

          <View className="flex-row flex-wrap">
            {SCORING_TEMPLATE_FAMILIES.map((item) => {
              const selected = templateFamily === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setTemplateFamily(item.value)}
                  className={
                    selected
                      ? 'rounded-xl border border-primary bg-primary px-3 py-2 mr-2 mb-2'
                      : 'rounded-xl border border-border bg-background px-3 py-2 mr-2 mb-2'
                  }
                >
                  <Text
                    className={
                      selected
                        ? 'font-semibold text-primary-foreground'
                        : 'font-semibold text-foreground'
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-footnote font-semibold text-foreground mt-2 mb-2">
            Division / Class
          </Text>

          <TextInput
            value={divisionKey}
            onChangeText={setDivisionKey}
            autoCapitalize="none"
            placeholder="Example: open, student, short, feature"
            placeholderTextColor={THEME.muted}
            className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
          />

          <Pressable
            onPress={createForm}
            className="rounded-xl bg-primary px-4 py-3 mt-3 flex-row justify-center items-center gap-2"
          >
            <Plus size={17} color={THEME.primaryFg} />
            <Text className="font-bold text-primary-foreground">
              Create Draft Form
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-headline font-semibold text-foreground">
            Scoring Forms
          </Text>

          <Pressable onPress={loadForms}>
            <RefreshCw size={19} color={THEME.accent} />
          </Pressable>
        </View>

        {forms.map((form) => (
          <Pressable
            key={form.id}
            onPress={() => openForm(form)}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-headline font-semibold text-card-foreground">
              {form.name}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Version {form.version} · {String(form.status).toUpperCase()}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Family: {scoringTemplateFamilyLabel(form.template_family)} · Division:{' '}
              {String(form.division_key || 'open')}
            </Text>
          </Pressable>
        ))}

        {forms.length === 0 && (
          <View className="rounded-2xl border border-border bg-card p-5 mb-4">
            <Text className="text-muted-foreground">
              No scoring forms created yet.
            </Text>
          </View>
        )}

        {selectedForm && (
          <View className="rounded-2xl border border-border bg-card p-4 mt-3">
            <Text className="text-title3 font-bold text-card-foreground">
              {selectedForm.name}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Version {selectedForm.version} · {String(selectedForm.status).toUpperCase()}
            </Text>

            <Text className="text-footnote text-muted-foreground mt-1">
              Family: {scoringTemplateFamilyLabel(selectedForm.template_family)} · Division:{' '}
              {String(selectedForm.division_key || 'open')}
            </Text>

            <Text className="text-headline font-semibold text-card-foreground mt-5">
              Criteria
            </Text>

            {criteria.map((row) => (
              <View
                key={row.id}
                className="rounded-xl border border-border bg-background p-3 mt-2"
              >
                {editingCriterionId === String(row.id) ? (
                  <>
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Criterion name"
                      placeholderTextColor={THEME.muted}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
                    />

                    <TextInput
                      value={editWeight}
                      onChangeText={setEditWeight}
                      keyboardType="numeric"
                      placeholder="Weight %"
                      placeholderTextColor={THEME.muted}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-foreground mt-2"
                    />

                    <Pressable
                      onPress={() =>
                        setEditCommentRequired((value) => !value)
                      }
                      className="rounded-xl border border-border bg-card px-4 py-3 mt-2"
                    >
                      <Text className="text-foreground">
                        Required Comment:{' '}
                        {editCommentRequired ? 'YES' : 'NO'}
                      </Text>
                    </Pressable>

                    <View className="flex-row gap-2 mt-3">
                      <Pressable
                        onPress={() => saveCriterionEdit(row)}
                        className="flex-1 rounded-xl bg-primary px-4 py-3 items-center"
                      >
                        <Text className="font-bold text-primary-foreground">
                          Save Changes
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={cancelCriterionEdit}
                        className="flex-1 rounded-xl border border-border px-4 py-3 items-center"
                      >
                        <Text className="font-semibold text-foreground">
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text className="font-semibold text-foreground">
                      {row.label}
                    </Text>

                    <Text className="text-footnote text-muted-foreground mt-1">
                      Weight: {row.weight_percent}% · Comment:{' '}
                      {row.comment_required ? 'REQUIRED' : 'OPTIONAL'}
                    </Text>

                    {selectedForm.status === 'draft' && (
                      <View className="flex-row gap-2 mt-3">
                        <Pressable
                          onPress={() => beginCriterionEdit(row)}
                          className="flex-1 rounded-xl border border-primary px-3 py-2 items-center"
                        >
                          <Text className="font-semibold text-primary">
                            Edit
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => confirmDeleteCriterion(row)}
                          className="flex-1 rounded-xl border border-border px-3 py-2 items-center"
                        >
                          <Text className="font-semibold text-foreground">
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}

            <View className="rounded-xl border border-border bg-background p-4 mt-4">
              <Text className="text-headline font-bold text-card-foreground">
                Scoring Weight Allocation
              </Text>

              <View className="h-3 rounded-full bg-card overflow-hidden mt-3">
                <View
                  className="h-3 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(totalWeight, 100)}%`,
                  }}
                />
              </View>

              <View className="flex-row justify-between mt-3">
                <Text className="text-primary font-bold">
                  Allocated: {totalWeight}%
                </Text>

                <Text className="text-muted-foreground font-semibold">
                  Remaining: {remainingWeight}%
                </Text>
              </View>

              <Text className="text-footnote text-muted-foreground mt-2">
                {totalWeight === 100
                  ? 'COMPLETE — ready to activate ✅'
                  : 'Required to activate: exactly 100%'}
              </Text>
            </View>

            {selectedForm.status === 'draft' && (
              <>
                <Pressable
                  onPress={loadStandardAssessmentPreset}
                  className="rounded-xl border border-primary px-4 py-3 mt-4 flex-row justify-center items-center gap-2"
                >
                  <ClipboardCheck size={17} color={THEME.accent} />
                  <Text className="font-bold text-primary">
                    {SCORING_TEMPLATE_PRESETS[
                      String(selectedForm.template_family || 'general_film') as keyof typeof SCORING_TEMPLATE_PRESETS
                    ]
                      ? `Load ${
                          SCORING_TEMPLATE_PRESETS[
                            String(selectedForm.template_family || 'general_film') as keyof typeof SCORING_TEMPLATE_PRESETS
                          ].label
                        }`
                      : 'Standard Preset Not Yet Available'}
                  </Text>
                </Pressable>

                <TextInput
                  value={criterionName}
                  onChangeText={setCriterionName}
                  placeholder="Criterion name"
                  placeholderTextColor={THEME.muted}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mt-4"
                />

                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="Weight %"
                  placeholderTextColor={THEME.muted}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mt-2"
                />

                <Pressable
                  onPress={() => setCommentRequired((v) => !v)}
                  className="rounded-xl border border-border bg-background px-4 py-3 mt-2"
                >
                  <Text className="text-foreground">
                    Required Comment: {commentRequired ? 'YES' : 'NO'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={addCriterion}
                  className="rounded-xl border border-primary px-4 py-3 mt-3 flex-row justify-center items-center gap-2"
                >
                  <Plus size={17} color={THEME.accent} />
                  <Text className="font-bold text-primary">
                    Add Criterion
                  </Text>
                </Pressable>

                <Pressable
                  onPress={activateForm}
                  disabled={totalWeight !== 100}
                  style={{
                    opacity: totalWeight === 100 ? 1 : 0.45,
                  }}
                  className="rounded-xl bg-primary px-4 py-3 mt-3 flex-row justify-center items-center gap-2"
                >
                  <CheckCircle2 size={17} color={THEME.primaryFg} />
                  <Text className="font-bold text-primary-foreground">
                    {totalWeight === 100
                      ? 'Activate Form'
                      : `Activate Form — ${remainingWeight}% Remaining`}
                  </Text>
                </Pressable>
              </>
            )}

            {selectedForm.status === 'active' && (
              <View className="rounded-xl border border-primary p-3 mt-4 flex-row items-center gap-2">
                <ClipboardCheck size={18} color={THEME.accent} />
                <Text className="text-primary font-semibold">
                  ACTIVE — ready for jury assignments
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
