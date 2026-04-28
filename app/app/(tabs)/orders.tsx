import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { OrderCard } from '@/src/features/orders/components/OrderCard';
import { useOrders } from '@/src/features/orders/hooks/use-orders';
import { rebuyOrder } from '@/src/features/orders/api/orders-api';
import type { Order } from '@/src/features/orders/types/order';
import { useCartStore } from '@/src/features/cart/store/cart-store';
import { Screen } from '@/src/shared/components/Screen';
import { StateView } from '@/src/shared/components/StateView';
import { getErrorMessage } from '@/src/shared/api/errors';
import { colors, spacing, typography } from '@/src/shared/theme/theme';

export default function OrdersScreen() {
  const router = useRouter();
  const ordersQuery = useOrders();
  const addLinesForRebuy = useCartStore((state) => state.addLinesForRebuy);

  const rebuyMutation = useMutation({
    mutationFn: rebuyOrder,
    onSuccess: async (response) => {
      await addLinesForRebuy(response.lines);
      router.push('/cart');
    }
  });

  const handleRebuy = useCallback(
    (order: Order) => {
      rebuyMutation.mutate(order.id);
    },
    [rebuyMutation]
  );

  const orders = ordersQuery.data?.items ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Demo history</Text>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.note}>
          {ordersQuery.data?.limitation ??
            'Order history is ready for authenticated customer data; this POC uses backend demo orders.'}
        </Text>
        {rebuyMutation.isError ? (
          <Text style={styles.error}>{getErrorMessage(rebuyMutation.error)}</Text>
        ) : null}
      </View>

      {ordersQuery.isLoading ? (
        <StateView title="Loading orders" message="Fetching the latest backend order view." />
      ) : ordersQuery.isError ? (
        <StateView
          title="Orders could not load"
          message="The backend orders endpoint may be unavailable."
          actionLabel="Try again"
          onAction={() => void ordersQuery.refetch()}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onRebuy={handleRebuy}
              rebuying={rebuyMutation.isPending && rebuyMutation.variables === item.id}
            />
          )}
          contentContainerStyle={[styles.listContent, orders.length === 0 && styles.centeredList]}
          ListEmptyComponent={
            <StateView
              title="No orders yet"
              message="Completed checkout data needs customer auth or webhooks before it can be production-grade."
            />
          }
          showsVerticalScrollIndicator={false}
          refreshing={ordersQuery.isRefetching}
          onRefresh={() => void ordersQuery.refetch()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    letterSpacing: 0
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '700'
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  centeredList: {
    flexGrow: 1,
    justifyContent: 'center'
  }
});
