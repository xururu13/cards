import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { syncWithDrive } from './drive';
import { getGoogleToken, restoreGoogleSignIn } from './google';

/** Тихая синхронизация при запуске, если аккаунт Google уже подключён. Ошибки не показываются. */
export function AutoSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    (async () => {
      if (await restoreGoogleSignIn()) await syncWithDrive(db, getGoogleToken);
    })().catch((error: unknown) => console.warn('Автосинхронизация не удалась', error));
  }, [db]);
  return null;
}
