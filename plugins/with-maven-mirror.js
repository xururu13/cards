// Зеркало Maven Central от Google ставится первым источником зависимостей.
// Maven Central перенаправляет библиотеки React Native на repo.reactnative.dev, который из нашей
// сети почти не отдаёт данные (релизная сборка падала с «Read timed out»). Зеркало Google отдаёт быстро.
const { withProjectBuildGradle } = require('expo/config-plugins');

const MIRROR = "maven { url 'https://maven-central.storage-download.googleapis.com/maven2/' } // kartochki-maven-mirror";

module.exports = function withMavenMirror(config) {
  return withProjectBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes('kartochki-maven-mirror')) return config;
    const count = (gradle.match(/repositories \{\n/g) ?? []).length;
    if (count === 0) throw new Error('with-maven-mirror: не найден блок repositories');
    gradle = gradle.replace(/repositories \{\n(\s*)/g, (_, indent) => `repositories {\n${indent}${MIRROR}\n${indent}`);
    config.modResults.contents = gradle;
    return config;
  });
};
