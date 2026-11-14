import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function pickAttachments() {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, base64: false });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(async asset => {
    if (asset.size > 20 * 1024 * 1024) throw new Error('Choose files smaller than 20 MB.');
    let data;
    if (Platform.OS === 'web') {
      data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Unable to read file.'));
        reader.readAsDataURL(asset.file);
      });
    } else {
      data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    }
    return { name: asset.name, mimeType: asset.mimeType || 'application/octet-stream', size: asset.size, data };
  }));
}

export async function openAttachment(file) {
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  const uri = FileSystem.cacheDirectory + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  await FileSystem.writeAsStringAsync(uri, file.data, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: file.mimeType, dialogTitle: file.name });
}
