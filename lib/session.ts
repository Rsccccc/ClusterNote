import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'cn_session_username';

export async function saveSession(username: string) {
  await AsyncStorage.setItem(SESSION_KEY, username);
}

export async function getSession(): Promise<string | null> {
  return await AsyncStorage.getItem(SESSION_KEY);
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
