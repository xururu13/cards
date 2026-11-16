import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & { accessory?: React.ReactNode; highlighted?: boolean };

export function TextField({ accessory, highlighted, multiline, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.box,
        { borderColor: highlighted ? theme.accent : theme.border },
        multiline && styles.multiline,
      ]}>
      <TextInput
        multiline={multiline}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }, multiline && styles.inputMultiline, style]}
        {...rest}
      />
      {accessory && (
        // В многострочном поле значки стоят под текстом, чтобы не сужать его.
        <View style={multiline && styles.accessoryBelow}>{accessory}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
  multiline: {
    flexDirection: 'column',
    alignItems: 'stretch',
    minHeight: 112,
    paddingVertical: Spacing.two,
  },
  accessoryBelow: { alignSelf: 'flex-end' },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  inputMultiline: { flex: 0, textAlignVertical: 'top', minHeight: 64, paddingVertical: 0 },
});
