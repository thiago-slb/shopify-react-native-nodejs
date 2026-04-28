import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';
import { formatMoney } from '@/src/shared/utils/money';
import type { Order } from '../types/order';

type OrderCardProps = {
  order: Order;
  onRebuy: (order: Order) => void;
  rebuying?: boolean;
};

export const OrderCard = memo(function OrderCard({ order, onRebuy, rebuying }: OrderCardProps) {
  const preview = order.lines.slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order {order.orderNumber}</Text>
          <Text style={styles.meta}>
            {new Date(order.processedAt).toLocaleDateString()} · {order.status}
          </Text>
        </View>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>

      <View style={styles.previewRow}>
        {preview.map((line) =>
          line.imageUrl ? (
            <Image key={line.id} source={{ uri: line.imageUrl }} style={styles.previewImage} />
          ) : (
            <View key={line.id} style={styles.previewFallback}>
              <Ionicons name="image-outline" size={18} color={colors.muted} />
            </View>
          )
        )}
        <View style={styles.itemSummary}>
          <Text style={styles.itemText} numberOfLines={2}>
            {order.lines.map((line) => `${line.quantity}x ${line.title}`).join(', ')}
          </Text>
        </View>
      </View>

      <Pressable
        disabled={rebuying}
        onPress={() => onRebuy(order)}
        style={({ pressed }) => [styles.button, pressed && !rebuying && styles.pressed]}>
        {rebuying ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.buttonText}>Purchase again</Text>
          </>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  orderNumber: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900'
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: spacing.xs
  },
  total: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900'
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: radii.sm
  },
  previewFallback: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemSummary: {
    flex: 1
  },
  itemText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18
  },
  button: {
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  pressed: {
    backgroundColor: colors.surfaceAlt
  },
  buttonText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900'
  }
});
