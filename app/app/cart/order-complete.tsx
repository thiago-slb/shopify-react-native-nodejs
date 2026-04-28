import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/src/shared/components/PrimaryButton';
import { Screen } from '@/src/shared/components/Screen';
import { colors, radii, spacing, typography } from '@/src/shared/theme/theme';

export default function OrderCompleteScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="checkmark" size={42} color={colors.surface} />
        </View>
        <Text style={styles.title}>Checkout complete</Text>
        <Text style={styles.message}>
          Shopify Checkout Sheet reported completion. This POC still leaves payment and order
          reconciliation to backend auth or webhook work before it can be treated as production
          payment truth.
        </Text>
        <PrimaryButton label="View orders" onPress={() => router.replace('/(tabs)/orders')} />
        <PrimaryButton label="Back to Home" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg
  },
  icon: {
    width: 86,
    height: 86,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success
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
  }
});
