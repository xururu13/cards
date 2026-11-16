# Настройка входа Google и Google Drive

Приложение хранит копию данных в скрытой папке приложения на Google Drive пользователя
(scope `drive.appdata`): остальные файлы на Диске ему не видны. Секретов и ключей в коде нет —
Google узнаёт приложение по имени пакета и отпечатку ключа подписи.

## 1. Проект и Drive API

1. Откройте <https://console.cloud.google.com/> и создайте проект, например «Карточки».
2. **APIs & Services → Library** → найдите **Google Drive API** → **Enable**.

## 2. Экран согласия OAuth

1. **APIs & Services → OAuth consent screen** (в новом интерфейсе — **Google Auth Platform**).
2. Тип пользователей — **External**.
3. Название приложения, почта поддержки, почта разработчика — свои.
4. **Data access / Scopes** → добавьте `.../auth/drive.appdata`.
5. **Audience / Test users** → добавьте почты всех аккаунтов, с которыми будете входить
   (свой и ребёнка). Пока приложение в режиме «Testing», войти могут только они.

## 3. OAuth-клиент для Android

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

| Поле | Значение |
|---|---|
| Application type | Android |
| Package name | `com.kartochki.app` |
| SHA-1 certificate fingerprint | см. ниже |

Отпечаток отладочной сборки (общий отладочный ключ шаблона React Native):

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Проверить:

```bash
/opt/homebrew/opt/openjdk@17/bin/keytool -list -v -keystore android/app/debug.keystore -storepass android | grep SHA1
```

Для релизной сборки (этап 8) понадобится второй Android-клиент с SHA-1 релизного ключа.
Если приложение будет в Google Play с подписью Google, — SHA-1 из Play Console
(**Setup → App signing**).

Изменения в Google Cloud начинают действовать через несколько минут.

## Частые ошибки

| Что видно в приложении | Причина |
|---|---|
| «Вход через Google ещё не настроен…» (`DEVELOPER_ERROR`) | Нет Android-клиента, опечатка в имени пакета или SHA-1 |
| «Google Drive не дал доступ…» (403) | Не включён Google Drive API |
| Окно Google «Доступ заблокирован» | Аккаунт не добавлен в Test users |
| Детский аккаунт не входит | Family Link: родителю нужно разрешить вход в приложение |
