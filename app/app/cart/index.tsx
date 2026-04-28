import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CartLineRow } from '@/src/features/cart/components/CartLineRow';
import { useCartStore } from '@/src/features/cart/store/cart-store';
import { PrimaryButton } from '@/src/shared/components/PrimaryButton';
import { Screen } from '@/src/shared/components/Screen';
import { StateView } from '@/src/shared/components/StateView';
import { colors, spacing, typography } from '@/src/shared/theme/theme';
import { formatMoney } from '@/src/shared/utils/money';

export default function CartScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const syncStatus = useCartStore((state) => state.syncStatus);
  const lastError = useCartStore((state) => state.lastError);
  const changeQuantity = useCartStore((state) => state.changeQuantity);
  const removeLine = useCartStore((state) => state.removeLine);

  const subtotal = items.reduce((total, item) => {
    return total + Number(item.merchandise.price.amount) * item.quantity;
  }, 0);
  const currencyCode = items[0]?.merchandise.price.currencyCode ?? 'USD';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.subtitle}>
          {items.length === 0 ? 'Your bag is ready when you are.' : `${items.length} item groups`}
        </Text>
        {lastError ? <Text style={styles.error}>Sync issue: {lastError}</Text> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CartLineRow
            line={item}
            disabled={syncStatus === 'syncing'}
            onQuantityChange={(line, quantity) => void changeQuantity(line, quantity)}
            onRemove={(lineId) => void removeLine(lineId)}
          />
        )}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.centeredList]}
        ListEmptyComponent={
          <StateView
            title="Your cart is empty"
            message="Add a product from Home and this modal will keep it synced with Shopify."
          />
        }
      />

      {items.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>
              {formatMoney({ amount: subtotal.toFixed(2), currencyCode })}
            </Text>
          </View>
          <PrimaryButton
            label="Continue to checkout"
            loading={syncStatus === 'syncing'}
            disabled={syncStatus === 'syncing'}
            onPress={() => router.push('/cart/checkout')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '700'
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 150
  },
  centeredList: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  subtotalLabel: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '700'
  },
  subtotalValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900'
  }
});
