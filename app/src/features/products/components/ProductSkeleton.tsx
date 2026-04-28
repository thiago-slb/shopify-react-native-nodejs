import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/shared/theme/theme';

export const ProductSkeleton = memo(function ProductSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.lineLarge} />
      <View style={styles.lineSmall} />
      <View style={styles.button} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md
  },
  image: {
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt
  },
  lineLarge: {
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt
  },
  lineSmall: {
    width: '56%',
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt
  },
  button: {
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt
  }
});
