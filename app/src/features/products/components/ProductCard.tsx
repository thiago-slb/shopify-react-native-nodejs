import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';
import { formatMoney } from '@/src/shared/utils/money';
import type { Product, ProductVariant } from '../types/product';

type ProductCardProps = {
  product: Product;
  onAddToCart: (product: Product, variant: ProductVariant) => void;
  disabled?: boolean;
};

export const ProductCard = memo(function ProductCard({
  product,
  onAddToCart,
  disabled
}: ProductCardProps) {
  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.availableForSale) ?? product.variants[0],
    [product.variants]
  );
  const image = product.images[0];
  const isAvailable = product.availableForSale && selectedVariant?.availableForSale;

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image
            source={{ uri: image.url }}
            style={styles.image}
            contentFit="cover"
            transition={160}
            accessibilityLabel={image.altText ?? product.title}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={28} color={colors.muted} />
          </View>
        )}
        <View style={[styles.availabilityPill, isAvailable ? styles.available : styles.soldOut]}>
          <Text style={styles.availabilityText}>{isAvailable ? 'In stock' : 'Sold out'}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.price}>{formatMoney(product.priceRange.minVariantPrice)}</Text>

      <Pressable
        disabled={!isAvailable || !selectedVariant || disabled}
        onPress={() => selectedVariant && onAddToCart(product, selectedVariant)}
        style={({ pressed }) => [
          styles.addButton,
          (!isAvailable || disabled) && styles.addButtonDisabled,
          pressed && isAvailable && !disabled && styles.pressed
        ]}>
        <Ionicons name="bag-add-outline" size={16} color={colors.surface} />
        <Text style={styles.addButtonText}>Add</Text>
      </Pressable>
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
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  imageWrap: {
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt
  },
  image: {
    aspectRatio: 1
  },
  imageFallback: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  availabilityPill: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  available: {
    backgroundColor: colors.success
  },
  soldOut: {
    backgroundColor: colors.muted
  },
  availabilityText: {
    color: colors.surface,
    fontSize: typography.tiny,
    fontWeight: '800'
  },
  title: {
    minHeight: 40,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 20
  },
  price: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700'
  },
  addButton: {
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs
  },
  addButtonDisabled: {
    opacity: 0.45
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  addButtonText: {
    color: colors.surface,
    fontSize: typography.small,
    fontWeight: '800'
  }
});
