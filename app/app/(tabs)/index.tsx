import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { CartFab } from '@/src/features/cart/components/CartFab';
import { useCartStore } from '@/src/features/cart/store/cart-store';
import { ProductCard } from '@/src/features/products/components/ProductCard';
import { ProductSkeleton } from '@/src/features/products/components/ProductSkeleton';
import { useProducts } from '@/src/features/products/hooks/use-products';
import type { Product, ProductVariant } from '@/src/features/products/types/product';
import { Screen } from '@/src/shared/components/Screen';
import { StateView } from '@/src/shared/components/StateView';
import { useDebounce } from '@/src/shared/hooks/use-debounce';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';

const skeletonItems = Array.from({ length: 6 }, (_, index) => `skeleton-${index}`);

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const addProduct = useCartStore((state) => state.addProduct);
  const syncStatus = useCartStore((state) => state.syncStatus);
  const lastError = useCartStore((state) => state.lastError);
  const clearError = useCartStore((state) => state.clearError);
  const productsQuery = useProducts(debouncedSearch);

  const products = productsQuery.data?.items ?? [];
  const isInitialLoading = productsQuery.isLoading && products.length === 0;

  const handleAddToCart = useCallback(
    (product: Product, variant: ProductVariant) => {
      void addProduct(product, variant);
    },
    [addProduct]
  );

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} onAddToCart={handleAddToCart} disabled={syncStatus === 'syncing'} />
    ),
    [handleAddToCart, syncStatus]
  );

  const renderSkeleton = useCallback(() => <ProductSkeleton />, []);
  const contentContainerStyle = useMemo(
    () => [styles.listContent, products.length === 0 && !isInitialLoading && styles.centeredList],
    [isInitialLoading, products.length]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Storefront POC</Text>
        <Text style={styles.title}>Shopify products</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {productsQuery.isFetching && !isInitialLoading ? (
            <Ionicons name="sync-outline" size={18} color={colors.muted} />
          ) : null}
        </View>
        {lastError ? (
          <Text style={styles.syncError} onPress={clearError}>
            Cart sync failed: {lastError}
          </Text>
        ) : null}
      </View>

      {isInitialLoading ? (
        <FlatList
          data={skeletonItems}
          keyExtractor={(item) => item}
          renderItem={renderSkeleton}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : productsQuery.isError ? (
        <StateView
          title="Products could not load"
          message="Check that the backend is running and reachable from this device."
          actionLabel="Try again"
          onAction={() => void productsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id || item.handle}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={products.length > 0 ? styles.row : undefined}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          refreshing={productsQuery.isRefetching}
          onRefresh={() => void productsQuery.refetch()}
          ListEmptyComponent={
            <StateView
              title="No products found"
              message="Try a different search term or pull to refresh the catalog."
            />
          }
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <CartFab />
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
  searchBox: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 48
  },
  syncError: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '700'
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.md
  },
  centeredList: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md
  }
});
