import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Длинная сторона после сжатия: текст ещё читается, а фото весит ~200–400 КБ. */
const MAX_SIDE = 1600;

export type PhotoSource = 'camera' | 'library';

export interface Photo {
  uri: string;
  base64: string;
}

/**
 * Снимок с камеры или из галереи с обрезкой (чтобы оставить только нужный кусок текста),
 * затем сжатие. null — пользователь передумал.
 */
export async function takePhoto(source: PhotoSource): Promise<Photo | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Нет доступа к камере. Разреши его в настройках телефона.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('Не получилось подготовить фото. Попробуй ещё раз.');
  return { uri: saved.uri, base64: saved.base64 };
}
