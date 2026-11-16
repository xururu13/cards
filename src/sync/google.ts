import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { DRIVE_SCOPE, type GetToken } from './drive';

GoogleSignin.configure({ scopes: [DRIVE_SCOPE] });

/** Почта вошедшего аккаунта или null. */
export function currentGoogleEmail(): string | null {
  return GoogleSignin.getCurrentUser()?.user.email ?? null;
}

/** Тихий вход по сохранённому аккаунту, без окна выбора. */
export async function restoreGoogleSignIn(): Promise<string | null> {
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? response.data.user.email : null;
}

/** Окно выбора аккаунта. Возвращает почту или null, если пользователь передумал. */
export async function signInWithGoogle(): Promise<string | null> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.scopes.includes(DRIVE_SCOPE)) {
      throw new Error('Без доступа к Google Drive синхронизация не работает. Разреши его при входе.');
    }
    return response.data.user.email;
  } catch (error) {
    throw new Error(describeGoogleError(error));
  }
}

export async function signOutOfGoogle(): Promise<void> {
  await GoogleSignin.signOut();
}

let lastToken: string | null = null;

export const getGoogleToken: GetToken = async (refresh) => {
  if (refresh && lastToken) await GoogleSignin.clearCachedAccessToken(lastToken);
  const { accessToken } = await GoogleSignin.getTokens();
  lastToken = accessToken;
  return accessToken;
};

export function describeGoogleError(error: unknown): string {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.IN_PROGRESS) return 'Вход уже идёт.';
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'На телефоне нет сервисов Google Play или их нужно обновить.';
    }
    // DEVELOPER_ERROR: в Google Cloud нет OAuth-клиента для этого приложения и ключа подписи.
    if (String(error.code) === '10' || /DEVELOPER_ERROR/.test(error.message)) {
      return 'Вход через Google ещё не настроен для этого приложения. Нужен OAuth-клиент в Google Cloud.';
    }
  }
  return error instanceof Error ? error.message : String(error);
}
