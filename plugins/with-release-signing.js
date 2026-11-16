// Подпись релизной сборки Android своим ключом вместо отладочного.
// Ключ и пароли лежат вне проекта: ~/.kartochki/keystore.properties (см. docs/release.md).
// Без этого файла релизный APK собирается неподписанным и не установится — так ошибку не пропустить.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// kartochki-release-signing';

const SIGNING = `
        release { ${MARKER}
            def propsFile = new File(System.getProperty("user.home"), ".kartochki/keystore.properties")
            if (propsFile.exists()) {
                def props = new Properties()
                propsFile.withInputStream { props.load(it) }
                storeFile new File(props.getProperty("storeFile").replace("~", System.getProperty("user.home")))
                storePassword props.getProperty("storePassword")
                keyAlias props.getProperty("keyAlias")
                keyPassword props.getProperty("keyPassword")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARKER)) return config;

    const debugBlock = /signingConfigs \{\n(\s+debug \{[\s\S]*?\n\s{8}\})/;
    if (!debugBlock.test(gradle)) throw new Error('with-release-signing: не найден блок signingConfigs.debug');
    gradle = gradle.replace(debugBlock, (match) => `${match}${SIGNING}`);

    // Только buildTypes.release: отладочная сборка должна остаться на отладочном ключе,
    // иначе вход Google при разработке перестанет работать (SHA-1 не совпадёт).
    const releaseUsesDebug = /(buildTypes \{[\s\S]*?\n\s+release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUsesDebug.test(gradle)) throw new Error('with-release-signing: не найден buildTypes.release');
    gradle = gradle.replace(
      releaseUsesDebug,
      '$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : null',
    );

    config.modResults.contents = gradle;
    return config;
  });
};
