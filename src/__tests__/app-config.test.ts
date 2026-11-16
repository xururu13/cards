import appJson from '../../app.json';

type Plugin = string | [string, Record<string, unknown>];
const plugins = appJson.expo.plugins as Plugin[];
const options = (name: string) => {
  const found = plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  return Array.isArray(found) ? found[1] : found ? {} : undefined;
};

describe('app.json', () => {
  it('не отключает микрофон: без RECORD_AUDIO голосовой ввод молча не работает', () => {
    expect(options('expo-speech-recognition')).toBeDefined();
    // microphonePermission: false в плагине камеры вырезает RECORD_AUDIO из манифеста всего приложения.
    expect(options('expo-image-picker')?.microphonePermission).not.toBe(false);
  });

  it('подключены плагины релизной подписи и зеркала Maven', () => {
    expect(plugins).toContain('./plugins/with-release-signing');
    expect(plugins).toContain('./plugins/with-maven-mirror');
  });
});
