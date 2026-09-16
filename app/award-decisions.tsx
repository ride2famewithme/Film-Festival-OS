import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';

import {
  listAwardDecisionCandidates,
  lockJurySubmissionResult,
  createAwardSafe,
  publishAward,
  queueDecisionNotification,
} from '@/data/workflows/commercial-awards';


function message(title:string, text:string) {
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as any).alert
  ) {
    (globalThis as any).alert(`${title}\n\n${text}`);
  } else {
    Alert.alert(title, text);
  }
}


export default function AwardDecisionsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any|null>(null);
  const [awardName, setAwardName] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('');


  async function load() {
    try {
      const data = await listAwardDecisionCandidates();
      setRows(data);

      if (selected) {
        const refreshed = data.find(
          (x:any) => x.submission_id === selected.submission_id
        );

        if (refreshed)
          setSelected(refreshed);
      }
    } catch (e:any) {
      message('Decision & Awards', e.message);
    }
  }


  useEffect(() => {
    load();
  }, []);


  function choose(row:any) {
    setSelected(row);

    const existing = row.awards?.[0];

    setAwardName(existing?.award_name || '');
    setResultStatus(existing?.result_status || '');

    const title =
      row.submission?.title ||
      'Film Festival Entry';

    setSubject(
      existing
        ? `${title} — Festival Decision`
        : ''
    );

    setBody('');
    setNotificationStatus('');
  }


  async function lockJuryResult() {
    if (!selected) return;

    try {
      setBusy(true);

      await lockJurySubmissionResult(
        selected.submission_id
      );

      message(
        'Jury Result Locked',
        'The final jury result is now locked. Jury reviews can no longer be changed.'
      );

      await load();

    } catch (e:any) {
      message('Jury Lock Error', e.message);
    } finally {
      setBusy(false);
    }
  }


  async function recordDecision() {
    if (!selected) return;

    try {
      setBusy(true);

      const row = await createAwardSafe(
        selected.submission_id,
        awardName,
        resultStatus
      );

      message(
        'Decision Recorded',
        row.alreadyExists
          ? 'This award decision already exists.'
          : 'Draft award decision recorded successfully.'
      );

      await load();

    } catch (e:any) {
      message('Decision Error', e.message);

    } finally {
      setBusy(false);
    }
  }


  async function publishDecision() {
    const award = selected?.awards?.[0];

    if (!award || !selected)
      return;

    try {
      setBusy(true);

      await publishAward(
        award.id,
        selected.submission_id
      );

      message(
        'Published',
        'Award decision published successfully.'
      );

      await load();

    } catch (e:any) {
      message('Publish Error', e.message);

    } finally {
      setBusy(false);
    }
  }


  async function queueNotification() {
    if (!selected)
      return;

    try {
      setBusy(true);
      setNotificationStatus('QUEUEING: saving decision notification…');

      const result = await queueDecisionNotification(
        selected.submission_id,
        subject,
        body
      );

      const visibleStatus = result?.alreadyQueued
        ? 'ALREADY QUEUED — duplicate prevented.'
        : 'QUEUED — saved to notification outbox.';

      setNotificationStatus(visibleStatus);

      message(
        'Notification',
        result?.alreadyQueued
          ? 'Decision notification was already queued.'
          : 'Decision notification queued successfully.'
      );

    } catch (e:any) {
      const text = e?.message || String(e);
      setNotificationStatus(`ERROR: ${text}`);
      message('Notification Error', text);

    } finally {
      setBusy(false);
    }
  }


  const activeAward = selected?.awards?.[0];


  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal:20,
          paddingTop:30,
          paddingBottom:60,
        }}
      >

        <Pressable
          onPress={() => router.back()}
          className="mb-5"
        >
          <Text className="text-primary font-semibold">
            ← Back
          </Text>
        </Pressable>


        <Text className="text-title1 font-bold text-foreground">
          Decision & Awards Control
        </Text>

        <Text className="text-subhead text-muted-foreground mt-2 mb-6">
          Jury results inform the decision. Final awards remain human-controlled.
        </Text>


        {rows.length === 0 && (
          <View className="rounded-2xl border border-border bg-card p-5">
            <Text className="text-card-foreground">
              No completed jury results available.
            </Text>
          </View>
        )}


        {rows.map((row:any) => (
          <Pressable
            key={row.submission_id}
            onPress={() => choose(row)}
            className="rounded-2xl border border-border bg-card p-4 mb-3"
          >
            <Text className="text-headline font-semibold text-card-foreground">
              {row.submission?.title || row.submission_id}
            </Text>

            <Text className="text-muted-foreground mt-2">
              Jury score: {Number(row.weighted_score || 0).toFixed(2)}
            </Text>

            <Text className="text-muted-foreground">
              Reviews: {row.review_count}
            </Text>

            <Text className="text-muted-foreground">
              Jury weight represented: {Number(
                row.participating_weight_percent || 0
              ).toFixed(2)}%
            </Text>

            <Text className="text-muted-foreground">
              Jury result: {row.calculation_status === 'locked'
                ? 'LOCKED'
                : 'PROVISIONAL'}
            </Text>

            <Text className="text-primary font-semibold mt-3">
              {row.awards?.length
                ? 'Decision recorded'
                : 'Select for decision'}
            </Text>
          </Pressable>
        ))}


        {selected && (
          <View className="rounded-2xl border border-border bg-card p-5 mt-4">

            <Text className="text-title3 font-bold text-card-foreground">
              {selected.submission?.title}
            </Text>

            <Text className="text-muted-foreground mt-1">
              Jury result: {Number(
                selected.weighted_score || 0
              ).toFixed(2)} / 100
            </Text>

            <Text className="text-muted-foreground mb-4">
              Status: {selected.calculation_status === 'locked'
                ? 'LOCKED — FINAL'
                : 'PROVISIONAL'}
            </Text>

            {selected.calculation_status !== 'locked' && (
              <Pressable
                disabled={busy}
                onPress={lockJuryResult}
                className="rounded-xl border border-primary px-4 py-3 mb-4"
              >
                <Text className="font-bold text-primary text-center">
                  Lock Final Jury Result
                </Text>
              </Pressable>
            )}


            <Text className="font-semibold text-card-foreground mb-1">
              Award Name
            </Text>

            <TextInput
              value={awardName}
              onChangeText={setAwardName}
              placeholder="e.g. Best Short Film"
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-3"
            />


            <Text className="font-semibold text-card-foreground mb-1">
              Result Status
            </Text>

            <TextInput
              value={resultStatus}
              onChangeText={setResultStatus}
              placeholder="e.g. Winner, Finalist, Official Selection"
              className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-4"
            />


            {!activeAward && (
              <Pressable
                disabled={busy}
                onPress={recordDecision}
                className="rounded-xl bg-primary px-4 py-3 mb-3"
              >
                <Text className="font-bold text-primary-foreground text-center">
                  Record Draft Decision
                </Text>
              </Pressable>
            )}


            {activeAward && (
              <>
                <Text className="text-card-foreground mt-2">
                  Award: {activeAward.award_name}
                </Text>

                <Text className="text-card-foreground">
                  Result: {activeAward.result_status}
                </Text>

                <Text className="text-card-foreground mb-4">
                  Publication: {activeAward.publication_status}
                </Text>


                {activeAward.publication_status !== 'published' && (
                  <Pressable
                    disabled={busy}
                    onPress={publishDecision}
                    className="rounded-xl bg-primary px-4 py-3 mb-5"
                  >
                    <Text className="font-bold text-primary-foreground text-center">
                      Publish Award Decision
                    </Text>
                  </Pressable>
                )}


                {activeAward.publication_status === 'published' && (
                  <>
                    <Text className="font-semibold text-card-foreground mb-1">
                      Decision Email Subject
                    </Text>

                    <TextInput
                      value={subject}
                      onChangeText={setSubject}
                      placeholder="Decision notification subject"
                      className="rounded-xl border border-border bg-background px-4 py-3 text-foreground mb-3"
                    />

                    <Text className="font-semibold text-card-foreground mb-1">
                      Decision Message
                    </Text>

                    <TextInput
                      value={body}
                      onChangeText={setBody}
                      multiline
                      placeholder="Decision notification message"
                      className="rounded-xl border border-border bg-background px-4 py-3 text-foreground min-h-28 mb-4"
                    />

                    <Pressable
                      disabled={
                        busy ||
                        notificationStatus.startsWith('QUEUED') ||
                        notificationStatus.startsWith('ALREADY')
                      }
                      onPress={queueNotification}
                      className="rounded-xl bg-primary px-4 py-3"
                    >
                      <Text className="font-bold text-primary-foreground text-center">
                        {busy
                          ? 'Queueing…'
                          : notificationStatus.startsWith('QUEUED') ||
                            notificationStatus.startsWith('ALREADY')
                          ? 'Decision Notification Queued'
                          : 'Queue Decision Notification'}
                      </Text>
                    </Pressable>

                    {!!notificationStatus && (
                      <Text className="text-footnote text-muted-foreground mt-2">
                        {notificationStatus}
                      </Text>
                    )}
                  </>
                )}

              </>
            )}

          </View>
        )}

      </ScrollView>
    </View>
  );
}
