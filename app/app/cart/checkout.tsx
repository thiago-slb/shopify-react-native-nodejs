import {
  type CheckoutCompletedEvent,
  type CheckoutException,
  useShopifyCheckoutSheet
} from '@shopify/checkout-sheet-kit';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getCheckoutUrl } from '@/src/features/cart/api/cart-api';
import { useCartStore } from '@/src/features/cart/store/cart-store';
import { PrimaryButton } from '@/src/shared/components/PrimaryButton';
import { Screen } from '@/src/shared/components/Screen';
import { StateView } from '@/src/shared/components/StateView';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';

export default function CheckoutScreen() {
  const router = useRouter();
  const checkoutSheet = useShopifyCheckoutSheet();
  const cartId = useCartStore((state) => state.cartId);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [didPresent, setDidPresent] = useState(false);

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cartId) {
        throw new Error('Create a cart before checkout.');
      }

      return getCheckoutUrl(cartId);
    },
    onSuccess: (response) => {
      checkoutSheet.preload(response.checkoutUrl);
    }
  });

  const presentCheckout = useCallback(() => {
    const checkoutUrl = checkoutMutation.data?.checkoutUrl;

    if (!checkoutUrl) {
      return;
    }

    setCheckoutError(null);
    setDidPresent(true);
    checkoutSheet.present(checkoutUrl);
  }, [checkoutMutation.data?.checkoutUrl, checkoutSheet]);

  useEffect(() => {
    checkoutMutation.mutate();
    // This mutation intentionally starts once for the current cart session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const completed = checkoutSheet.addEventListener(
      'completed',
      (event: CheckoutCompletedEvent) => {
        const orderId = event.orderDetails.id;
        router.replace({
          pathname: '/cart/order-complete',
          params: { orderId }
        });
      }
    );
    const error = checkoutSheet.addEventListener('error', (event: CheckoutException) => {
      setCheckoutError(event.message ?? 'Checkout could not be completed.');
    });
    const close = checkoutSheet.addEventListener('close', () => {
      setDidPresent(false);
    });

    return () => {
      completed?.remove();
      error?.remove();
      close?.remove();
    };
  }, [checkoutSheet, router]);

  useEffect(() => {
    if (checkoutMutation.data?.checkoutUrl && !didPresent) {
      presentCheckout();
    }
  }, [checkoutMutation.data?.checkoutUrl, didPresent, presentCheckout]);

  if (checkoutMutation.isPending) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparing secure Shopify checkout</Text>
        </View>
      </Screen>
    );
  }

  if (checkoutMutation.isError || !checkoutMutation.data?.checkoutUrl) {
    return (
      <Screen>
        <StateView
          title="Checkout unavailable"
          message="The backend could not return a Shopify checkout URL for this cart."
          actionLabel="Try again"
          onAction={() => checkoutMutation.mutate()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.sheetBadge}>
          <Text style={styles.sheetBadgeText}>Shopify Checkout Sheet</Text>
        </View>
        <Text style={styles.title}>Checkout is ready</Text>
        <Text style={styles.message}>
          The native Shopify checkout sheet should open automatically. If it was dismissed, reopen it
          below.
        </Text>
        {checkoutError ? <Text style={styles.error}>{checkoutError}</Text> : null}
        <PrimaryButton label="Open checkout" onPress={presentCheckout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md
  },
  loadingText: {
    color: colors.muted,
    fontSize: typography.body
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg
  },
  sheetBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  sheetBadgeText: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900'
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center'
  },
  message: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center'
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'center'
  }
});
