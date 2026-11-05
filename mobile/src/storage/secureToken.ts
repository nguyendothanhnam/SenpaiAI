import * as SecureStore from 'expo-secure-store'
import type { TokenStorage } from './types'

const KEY = 'senpaiai.access-token'
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'com.senpaiai.mobile.auth',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// Serialize writes/deletes so logout cannot race a previous credential write.
let pending: Promise<unknown> = Promise.resolve()
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = pending.then(operation, operation)
  pending = next.catch(() => undefined)
  return next
}

export const secureToken: TokenStorage = {
  get: () => serialize(() => SecureStore.getItemAsync(KEY, options)),
  set: (token) => serialize(() => SecureStore.setItemAsync(KEY, token, options)),
  remove: () => serialize(() => SecureStore.deleteItemAsync(KEY, options)),
}
