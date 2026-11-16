const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

// Watch only shared source. Resolve React and native libraries from mobile,
// never from frontend/node_modules (the web uses a different React version).
config.watchFolders = [path.resolve(projectRoot, '../frontend/src/i18n/locales'), path.resolve(projectRoot, '../frontend/src/themes'), path.resolve(projectRoot, '../shared-games')]
// Keep nested dependency resolution inside mobile (Expo ships some nested modules).
// Shared files have no runtime imports; pin React explicitly to the native copy.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]
config.resolver.extraNodeModules = {
  '@games': path.resolve(projectRoot, '../shared-games'),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
}

module.exports = config
