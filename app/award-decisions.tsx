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
import { getActiveContext } from '@/data/session';
import QuickGuideHelp from '@/components/QuickGuideHelp';

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



function suggestedDecisionNotification(row:any, award:any) {
  const title =
    row?.submission?.title?.trim() ||
    'Film Festival Entry';

  const decision =
    award?.result_status?.trim() ||
    'Festival Decision';

  const awardName =
    award?.award_name?.trim() || '';

  const lines = [
    'Dear Entrant,',
    '',
    'Thank you for submitting your work to our festival.',
    '',
    'We are writing to confirm the published festival decision for your submission.',
    '',
    `Film: ${title}`,
    `Decision: ${decision}`,
    awardName ? `Award / Category: ${awardName}` : null,
    '',
    'Please keep this message with your festival records.',
    '',
    'Kind regards,',
    'Festival Team',
  ].filter((line) => line !== null);

  return {
    subject: `${title} — ${decision}`,
    body: lines.join('\n'),
  };
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

    const recipientEmail =
      selected?.submission?.email?.trim();

    if (!recipientEmail) {
      message(
        'Notification',
        'This submission has no entrant email address.'
      );
      return;
    }

    if (!subject.trim()) {
      message(
        'Notification',
        'Enter a notification subject before queueing.'
      );
      return;
    }

    if (!body.trim()) {
      message(
        'Notification',
        'Enter a decision message before queueing.'
      );
      return;
    }

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

  async function goBack() {
    try {
      const context = await getActiveContext();

      if (context?.role === 'platform_admin') {
        router.replace('/global-hq');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch {
      router.replace('/(tabs)/dashboard');
    }
  }


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
          onPress={goBack}
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

        <QuickGuideHelp
          purpose="Turn completed jury results into controlled festival decisions, awards and entrant notifications."
          steps={[
            'Select a submission with completed jury results.',
            'Lock the final jury result when review is complete, then record the festival decision.',
            'Publish the approved decision and queue the entrant notification.',
          ]}
          terms={[
            { label: 'PROVISIONAL', description: 'The jury result can still change and is not final.' },
            { label: 'LOCKED', description: 'The jury result is final and can no longer be changed through the normal judging workflow.' },
            { label: 'DECISION', description: 'The festival-controlled outcome such as Winner, Finalist or Official Selection.' },
            { label: 'PUBLISHED', description: 'The approved result has been released through the controlled awards workflow.' },
          ]}
          flow={['JURY RESULT', 'LOCK', 'RECORD DECISION', 'PUBLISH', 'NOTIFY']}
        />


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
                    <View className="rounded-2xl border border-border bg-background p-4 mb-4">
                      <Text className="text-caption font-bold uppercase tracking-widest text-primary">
                        ENTRANT NOTIFICATION
                      </Text>

                      <Text className="text-footnote text-card-foreground mt-2">
                        Recipient: {selected?.submission?.email || 'NO EMAIL RECORDED'}
                      </Text>

                      <Text className="text-footnote text-muted-foreground mt-1">
                        The notification is first placed into the controlled outbox.
                        Delivery status is handled separately by the notification workflow.
                      </Text>

                      <Pressable
                        disabled={busy}
                        onPress={() => {
                          const draft =
                            suggestedDecisionNotification(
                              selected,
                              activeAward
                            );

                          setSubject(draft.subject);
                          setBody(draft.body);
                          setNotificationStatus('');
                        }}
                        className="rounded-xl border border-primary px-4 py-3 mt-4"
                      >
                        <Text className="font-bold text-primary text-center">
                          Load Suggested Entrant Message
                        </Text>
                      </Pressable>
                    </View>

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
                        !selected?.submission?.email ||
                        !subject.trim() ||
                        !body.trim() ||
                        notificationStatus.startsWith('QUEUED') ||
                        notificationStatus.startsWith('ALREADY')
                      }
                      onPress={queueNotification}
                      className={`rounded-xl px-4 py-3 ${
                        !selected?.submission?.email
                          ? 'bg-muted opacity-60'
                          : 'bg-primary'
                      }`}
                    >
                      <Text
                        className={`font-bold text-center ${
                          !selected?.submission?.email
                            ? 'text-muted-foreground'
                            : 'text-primary-foreground'
                        }`}
                      >
                        {busy
                          ? 'Queueing…'
                          : !selected?.submission?.email
                          ? 'QUEUE DISABLED — NO ENTRANT EMAIL'
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

                    {!!activeAward?.id && (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/digital-award',
                            params: {
                              awardId: activeAward.id,
                            },
                          } as any)
                        }
                        className="rounded-xl border border-primary px-4 py-3 mt-3"
                      >
                        <Text className="font-bold text-center text-primary">
                          OPEN DIGITAL / NFT AWARD
                        </Text>
                      </Pressable>
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
