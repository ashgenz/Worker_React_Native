export { useColorScheme } from 'react-native';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export default function useColorScheme() {
  const colorScheme = useNativeColorScheme();
  
  // You can return a default fallback here if it ever comes back undefined
  return colorScheme ?? 'light';
}