import {
  ColorScheme,
  LogLevel,
  ShopifyCheckoutSheetProvider
} from '@shopify/checkout-sheet-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useState } from 'react';
import { isCheckoutSheetAvailable } from '@/src/features/checkout/checkout-sheet-availability';
import { colors } from '@/src/shared/theme/theme';

export const unstable_settings = {
  anchor: '(tabs)'
};

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );
  const app = (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="cart/index"
          options={{
            presentation: 'modal',
            title: 'Cart',
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false
          }}
        />
        <Stack.Screen
          name="cart/checkout"
          options={{
            title: 'Checkout',
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false
          }}
        />
        <Stack.Screen
          name="cart/order-complete"
          options={{
            title: 'Order complete',
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false
          }}
        />
      </Stack>
      <StatusBar style="dark" />
    </QueryClientProvider>
  );

  if (!isCheckoutSheetAvailable()) {
    return app;
  }

  return (
    <ShopifyCheckoutSheetProvider
      configuration={{
        colorScheme: ColorScheme.automatic,
        preloading: true,
        title: 'Checkout',
        logLevel: LogLevel.error,
        colors: {
          ios: {
            backgroundColor: colors.background,
            tintColor: colors.primary,
            closeButtonColor: colors.text
          },
          android: {
            light: {
              backgroundColor: colors.background,
              progressIndicator: colors.primary,
              headerBackgroundColor: colors.background,
              headerTextColor: colors.text,
              closeButtonColor: colors.text
            },
            dark: {
              backgroundColor: colors.text,
              progressIndicator: colors.primary,
              headerBackgroundColor: colors.text,
              headerTextColor: colors.surface,
              closeButtonColor: colors.surface
            }
          }
        }
      }}>
      {app}
    </ShopifyCheckoutSheetProvider>
  );
}
