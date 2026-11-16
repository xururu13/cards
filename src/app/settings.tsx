import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FieldLabel, FormError } from '@/components/form';
import { LanguageChips } from '@/components/language-chips';
import { OptionChips } from '@/components/option-chips';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getMeta } from '@/db/meta';
import {
  getSettings,
  ROUND_SIZE_OPTIONS,
  setSetting,
  TIMER_OPTIONS,
  type Settings,
} from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import { restoreBackupFile, shareBackupFile } from '@/sync/backup-file';
import { syncWithDrive } from '@/sync/drive';
import {
  currentGoogleEmail,
  describeGoogleError,
  getGoogleToken,
  signInWithGoogle,
  signOutOfGoogle,
} from '@/sync/google';

const TIMER_CHOICES = TIMER_OPTIONS.map((value) => ({
  value,
  label: value === 0 ? 'Выкл.' : `${value} с`,
}));
const SIZE_CHOICES = ROUND_SIZE_OPTIONS.map((value) => ({ value, label: String(value) }));

type Busy = 'sync' | 'signin' | 'save' | 'restore' | null;

function formatSyncTime(value: string | null): string {
  if (!value) return 'ещё не было';
  const date = new Date(Number(value));
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? `сегодня, ${time}`
    : `${date.toLocaleDateString('ru-RU')}, ${time}`;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState<string | null>(() => currentGoogleEmail());
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async () => ({
      settings: await getSettings(db),
      lastSync: await getMeta(db, 'lastSyncAt'),
      email: currentGoogleEmail(),
    }),
    [db],
  );

  const apply = (loaded: Awaited<ReturnType<typeof load>>) => {
    setSettings(loaded.settings);
    setLastSync(loaded.lastSync);
    setEmail(loaded.email);
  };

  const reload = async () => apply(await load());

  useEffect(() => {
    let active = true;
    load()
      .then((loaded) => {
        if (!active) return;
        setSettings(loaded.settings);
        setLastSync(loaded.lastSync);
        setEmail(loaded.email);
      })
      .catch((e: unknown) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [load]);

  if (!settings) return <StatusScreen error={error ?? undefined} />;

  /** Запускает действие, показывая индикатор и ошибку; одновременно идёт только одно. */
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setError(null);
    setSetting(db, key, value).catch((e: unknown) =>
      setError(`Не удалось сохранить настройку. ${errorText(e)}`),
    );
  };

  const sync = () =>
    run('sync', async () => {
      const result = await syncWithDrive(db, getGoogleToken);
      if (result.created) return 'Копия создана на Google Drive.';
      return result.changed > 0
        ? `Синхронизировано. Получено изменений: ${result.changed}.`
        : 'Синхронизировано. Новых изменений нет.';
    });

  const signIn = () =>
    run('signin', async () => {
      const signedIn = await signInWithGoogle();
      if (!signedIn) return null;
      setEmail(signedIn);
      try {
        const result = await syncWithDrive(db, getGoogleToken);
        return result.created
          ? 'Аккаунт подключён, копия создана на Google Drive.'
          : 'Аккаунт подключён, данные с Google Drive получены.';
      } catch (e) {
        throw new Error(`Аккаунт подключён, но синхронизация не удалась. ${describeGoogleError(e)}`);
      }
    });

  const signOut = () =>
    Alert.alert(
      'Отключить Google Drive?',
      'Данные на телефоне останутся. Копия на Диске тоже сохранится, но перестанет обновляться.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отключить',
          style: 'destructive',
          onPress: () =>
            run('signin', async () => {
              await signOutOfGoogle();
              setEmail(null);
              return 'Google Drive отключён.';
            }),
        },
      ],
    );

  const saveFile = () =>
    run('save', async () => {
      await shareBackupFile(db);
      return null;
    });

  const restoreFile = () =>
    Alert.alert(
      'Восстановить из файла?',
      'Карточки и стопки из файла добавятся к тем, что уже есть. Если запись есть и тут, и там, останется более свежая версия.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выбрать файл',
          onPress: () =>
            run('restore', async () => {
              const result = await restoreBackupFile(db);
              if (!result) return null;
              return result.changed > 0
                ? `Восстановлено записей: ${result.changed}.`
                : 'Всё из этого файла уже есть на телефоне.';
            }),
        },
      ],
    );

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
            ? 'Без таймера нет бонуса за скорость. Оценки 0 и 1 дают 0 очков. Оценки 2–5 дают 2, 5, 8, 10 очков.'
            : 'Быстрый ответ на 4–5: до +5 очков. Время вышло: −2. Повтор: половина базовых очков без бонуса.'}
        </ThemedText>
        <FieldLabel>Карточек в раунде</FieldLabel>
        <OptionChips
          options={SIZE_CHOICES}
          value={settings.roundSize}
          onChange={(value) => change('roundSize', value)}
        />

        <ThemedText type="smallBold" style={styles.section}>
          Язык
        </ThemedText>
        <FieldLabel>Язык по умолчанию</FieldLabel>
        <LanguageChips
          value={settings.defaultLanguage}
          onChange={(value) => change('defaultLanguage', value)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Подставляется в новые стопки для обеих сторон карточки. В самой стопке его можно поменять.
        </ThemedText>

        <ThemedText type="smallBold" style={styles.section}>
          Google Drive
        </ThemedText>
        {email ? (
          <>
            <View style={[styles.row, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Аккаунт
              </ThemedText>
              <ThemedText type="small" numberOfLines={1} style={styles.value}>
                {email}
              </ThemedText>
            </View>
            <View style={[styles.row, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Синхронизация
              </ThemedText>
              <ThemedText type="small">{formatSyncTime(lastSync)}</ThemedText>
            </View>
            <Button title="Синхронизировать" icon="sync" onPress={sync} />
            <Button title="Отключить Google Drive" variant="danger" onPress={signOut} />
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Карточки, прогресс и очки будут храниться в скрытой папке приложения на твоём Google
              Drive. Так их не потерять и можно продолжить на другом телефоне.
            </ThemedText>
            <Button title="Подключить Google Drive" icon="logo-google" onPress={signIn} />
          </>
        )}

        <ThemedText type="smallBold" style={styles.section}>
          Резервная копия в файл
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Работает и без Google: файл можно сохранить в «Файлы», отправить в мессенджер или
          перенести на компьютер.
        </ThemedText>
        <Button title="Сохранить в файл" icon="download-outline" onPress={saveFile} />
        <Button title="Восстановить из файла" icon="push-outline" onPress={restoreFile} />

        {busy && <ActivityIndicator color={theme.accent} style={styles.busy} />}
        <FormError message={error} />
        {notice && (
          <ThemedText type="small" style={{ color: theme.success }}>
            {notice}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  section: { marginTop: Spacing.four },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  value: { flexShrink: 1 },
  busy: { marginTop: Spacing.two },
});
