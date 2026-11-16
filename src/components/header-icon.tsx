import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
};

export function HeaderIcon({ name, label, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={12} onPress={onPress}>
      <Ionicons name={name} size={24} color={theme.text} />
    </Pressable>
  );
}
