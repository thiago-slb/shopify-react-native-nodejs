import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';
import { formatMoney } from '@/src/shared/utils/money';
import type { CartLine } from '../types/cart';

type CartLineRowProps = {
  line: CartLine;
  disabled?: boolean;
  onQuantityChange: (line: CartLine, quantity: number) => void;
  onRemove: (lineId: string) => void;
};

export const CartLineRow = memo(function CartLineRow({
  line,
  disabled,
  onQuantityChange,
  onRemove
}: CartLineRowProps) {
  return (
    <View style={styles.row}>
      {line.merchandise.image ? (
        <Image source={{ uri: line.merchandise.image.url }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="image-outline" size={22} color={colors.muted} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {line.merchandise.product.title}
        </Text>
        <Text style={styles.variant} numberOfLines={1}>
          {line.merchandise.title}
        </Text>
        <Text style={styles.price}>{formatMoney(line.cost.totalAmount)}</Text>

        <View style={styles.controls}>
          <Pressable
            disabled={disabled}
            style={styles.iconButton}
            onPress={() => onQuantityChange(line, line.quantity - 1)}>
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.quantity}>{line.quantity}</Text>
          <Pressable
            disabled={disabled}
            style={styles.iconButton}
            onPress={() => onQuantityChange(line, line.quantity + 1)}>
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
          <Pressable disabled={disabled} style={styles.remove} onPress={() => onRemove(line.id)}>
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  image: {
    width: 82,
    height: 82,
    borderRadius: radii.sm
  },
  imageFallback: {
    width: 82,
    height: 82,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 20
  },
  variant: {
    color: colors.muted,
    fontSize: typography.small
  },
  price: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '800'
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt
  },
  quantity: {
    minWidth: 22,
    color: colors.text,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: '800'
  },
  remove: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  removeText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '700'
  }
});
