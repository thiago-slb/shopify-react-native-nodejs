import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

type StateViewProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateView({ title, message, actionLabel, onAction }: StateViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    textAlign: 'center'
  },
  message: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center'
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700'
  }
});
