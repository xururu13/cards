# Релизная сборка Android

Релизный APK работает сам по себе, без компьютера и сервера разработки.

## Ключ подписи

Ключ создан один раз и лежит вне проекта:

| Файл | Что это |
|---|---|
| `~/.kartochki/release.keystore` | ключ подписи |
| `~/.kartochki/keystore.properties` | путь к ключу, псевдоним и пароли |

**Сохраните обе копии в надёжном месте** (менеджер паролей, зашифрованный архив). Если ключ
потерять, обновить установленное приложение будет нельзя: придётся удалить его и поставить
заново, а для Google Play — менять ключ через поддержку.

Подпись подключает плагин [plugins/with-release-signing.js](../plugins/with-release-signing.js).
Если файла `keystore.properties` нет, релизный APK соберётся неподписанным и не установится.

Отпечаток релизного ключа (нужен для Google Cloud, см. ниже):

```
SHA1: 9D:97:22:E0:5E:32:8F:CF:99:6B:6B:47:3D:17:05:33:CA:20:29:64
```

## Google Drive в релизной версии

В Google Cloud нужен **второй** OAuth-клиент типа Android: пакет `com.kartochki.app`,
SHA-1 релизного ключа (выше). Клиент для отладочного ключа оставьте — он нужен при разработке.

## Сборка

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
apk_version=$(node -p 'require("./app.json").expo.version')
apk_path="dist/kartochki-${apk_version}.apk"
npx expo prebuild --platform android --clean --no-install &&
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a) &&
  mkdir -p dist &&
  cp android/app/build/outputs/apk/release/app-release.apk "$apk_path"
```

Готовый файл для передачи имеет имя `dist/kartochki-<версия>.apk`.

Перед новой версией увеличьте `expo.version` и `expo.android.versionCode` в `app.json`.

Значения из `.env.local` (адрес, модель и ключ AI) встраиваются в APK при сборке.

## Установка

- По кабелю из того же терминала: `adb install -r "$apk_path"`.
- Без кабеля: отправьте файл на телефон (мессенджер, Диск) и откройте его. Android попросит
  разрешить установку из этого источника.

Отладочную и релизную версии нельзя поставить поверх друг друга: они подписаны разными ключами.
Чтобы сменить одну на другую, удалите приложение (данные удалятся вместе с ним), поставьте
новую версию и восстановите данные через Google Drive или из файла.
