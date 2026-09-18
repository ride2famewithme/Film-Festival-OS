import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Term = {
  label: string;
  description: string;
};

type Props = {
  purpose: string;
  steps?: string[];
  terms?: Term[];
  flow?: string[];
};

export default function QuickGuideHelp({
  purpose,
  steps = [],
  terms = [],
  flow = [],
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.button}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel="Open quick guide"
      >
        <Text style={styles.buttonText}>
          {open ? '× CLOSE QUICK GUIDE' : '? QUICK GUIDE / CHEATSHEET'}
        </Text>
      </Pressable>

      {open && (
        <View style={styles.panel}>
          <Text style={styles.heading}>WHAT THIS PAGE DOES</Text>
          <Text style={styles.body}>{purpose}</Text>

          {!!steps.length && (
            <>
              <Text style={styles.heading}>KISS — HOW TO USE IT</Text>
              {steps.map((step, index) => (
                <Text key={`${index}-${step}`} style={styles.body}>
                  {index + 1}. {step}
                </Text>
              ))}
            </>
          )}

          {!!terms.length && (
            <>
              <Text style={styles.heading}>WHAT THE OPTIONS MEAN</Text>
              {terms.map((term) => (
                <Text key={term.label} style={styles.body}>
                  <Text style={styles.bold}>{term.label}</Text> — {term.description}
                </Text>
              ))}
            </>
          )}

          {!!flow.length && (
            <>
              <Text style={styles.heading}>QUICK FLOW</Text>
              <Text style={styles.flow}>{flow.join('  →  ')}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 8,
  },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#111827',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: '#F9FAFB',
  },
  heading: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#111827',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  bold: {
    fontWeight: '800',
    color: '#111827',
  },
  flow: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#111827',
  },
});
