import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FieldLabel, FormError } from '@/components/form';
import { OptionChips } from '@/components/option-chips';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  getSettings,
  ROUND_SIZE_OPTIONS,
  setSetting,
  TIMER_OPTIONS,
  type Settings,
} from '@/db/settings';

const TIMER_CHOICES = TIMER_OPTIONS.map((value) => ({
  value,
  label: value === 0 ? 'Выключен' : `${value} сек`,
}));
const SIZE_CHOICES = ROUND_SIZE_OPTIONS.map((value) => ({ value, label: String(value) }));

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSettings(db)
      .then((loaded) => active && setSettings(loaded))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [db]);

  if (!settings) return <StatusScreen error={error ?? undefined} />;

  const change = (key: keyof Settings, value: number) => {
    setSettings({ ...settings, [key]: value });
    setError(null);
    setSetting(db, key, value).catch((e: unknown) =>
      setError(`Не удалось сохранить настройку. ${e instanceof Error ? e.message : String(e)}`),
    );
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">Раунд</ThemedText>
        <FieldLabel>Таймер на ответ</FieldLabel>
        <OptionChips
          options={TIMER_CHOICES}
          value={settings.timerSeconds}
          onChange={(value) => change('timerSeconds', value)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {settings.timerSeconds === 0
            ? 'Без таймера нет бонуса за скорость.'
            : 'Когда время выходит, оборот открывается сам и снимается 5 очков.'}
        </ThemedText>
        <FieldLabel>Карточек в раунде</FieldLabel>
        <OptionChips
          options={SIZE_CHOICES}
          value={settings.roundSize}
          onChange={(value) => change('roundSize', value)}
        />
        <FormError message={error} />
        <ThemedText type="smallBold" style={styles.section}>
          Резервная копия и Google Drive
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Появится на этапе 5.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two },
  section: { marginTop: Spacing.four },
});
