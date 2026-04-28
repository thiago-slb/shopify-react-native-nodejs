import { NativeModules } from 'react-native';

export function isCheckoutSheetAvailable(): boolean {
  return Boolean(NativeModules.ShopifyCheckoutSheetKit);
}
