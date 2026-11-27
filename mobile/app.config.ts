import type { ExpoConfig } from 'expo/config'
import vi from './src/i18n/locales/vi.json'
import en from './src/i18n/locales/en.json'

const config: ExpoConfig = {
  name: 'SenpaiAI',
  slug: 'senpai-ai-mobile',
  owner: 'nguyennam34',
  extra: { eas: { projectId: 'f2335981-13b8-42ab-bae0-0930e4507f2d' } },
  version: '0.3.0',
  description: vi.phase3.description,
  locales: {
    vi: { ios: { NSLocalNetworkUsageDescription: vi.phase3.localNetworkUsage }, android: { app_name: 'SenpaiAI' } },
    en: { ios: { NSLocalNetworkUsageDescription: en.phase3.localNetworkUsage }, android: { app_name: 'SenpaiAI' } },
  },
  icon: './assets/icon.png',
  backgroundColor: '#fff7ed',
  scheme: 'senpaiai',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  platforms: ['android', 'ios'],
  plugins: [
    'expo-router', 'expo-secure-store', 'expo-localization', 'expo-status-bar', 'expo-font', 'expo-notifications', 'expo-sharing',
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.SENPAIAI_DEV_BUILD === '1' || (process.env.EXPO_PUBLIC_API_URL?.startsWith('http://') ?? false) } }],
  ],
  ios: {
    buildNumber: '3',
    bundleIdentifier: 'com.senpaiai.mobile',
    supportsTablet: true,
    infoPlist: {
      NSLocalNetworkUsageDescription: vi.phase3.localNetworkUsage,
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: { package: 'com.senpaiai.mobile', versionCode: 3, softwareKeyboardLayoutMode: 'resize' },
  experiments: { typedRoutes: true },
}

export default config
