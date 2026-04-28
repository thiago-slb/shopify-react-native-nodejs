import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';
import { useCartStore } from '../store/cart-store';

export const CartFab = memo(function CartFab() {
  const router = useRouter();
  const itemCount = useCartStore((state) => state.itemCount);
  const addedPulse = useCartStore((state) => state.addedPulse);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (addedPulse === 0) {
      return;
    }

    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true })
    ]).start();
  }, [addedPulse, scale]);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <Pressable style={styles.button} onPress={() => router.push('/cart')}>
        <Ionicons name="bag-outline" size={26} color={colors.surface} />
        {itemCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    zIndex: 20
  },
  button: {
    width: 62,
    height: 62,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -3,
    minWidth: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    paddingHorizontal: spacing.xs
  },
  badgeText: {
    color: colors.surface,
    fontSize: typography.tiny,
    fontWeight: '900'
  }
});
