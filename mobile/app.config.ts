import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'SenpaiAI',
  slug: 'senpai-ai-mobile',
  version: '0.1.0',
  scheme: 'senpaiai',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['android', 'ios'],
  plugins: [
    'expo-router', 'expo-secure-store', 'expo-localization', 'expo-status-bar', 'expo-font',
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.EXPO_PUBLIC_API_URL?.startsWith('http://') ?? false } }],
  ],
  ios: {
    bundleIdentifier: 'com.senpaiai.mobile',
    supportsTablet: true,
    infoPlist: {
      NSLocalNetworkUsageDescription: 'SenpaiAI connects to your development backend on the local network.',
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: { package: 'com.senpaiai.mobile' },
  experiments: { typedRoutes: true },
}

export default config
