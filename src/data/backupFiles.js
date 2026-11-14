import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { validateBackup, localDate } from './study';

export async function exportBackupFile(backup) {
  const text = JSON.stringify(backup);
  const name = `studyvault-${localDate()}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    const uri = FileSystem.cacheDirectory + name;
    await FileSystem.writeAsStringAsync(uri, text);
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save StudyVault backup' });
  }
}

export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, base64: false });
  if (result.canceled) return null;
  const file = result.assets[0];
  try {
    const text = Platform.OS === 'web' ? await file.file.text() : await FileSystem.readAsStringAsync(file.uri);
    return validateBackup(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('The selected file is not valid JSON.');
    throw e;
  } finally { if (Platform.OS === 'web') URL.revokeObjectURL(file.uri); }
}
