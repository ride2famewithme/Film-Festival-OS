const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" resolution (modern packages rely on it).
config.resolver.unstable_enablePackageExports = true;

// withNativeWind wires the Tailwind/NativeWind transformer — without it,
// className styling does nothing under real Metro.
module.exports = withNativeWind(config, { input: './global.css' });
