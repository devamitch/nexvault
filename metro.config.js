// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Support custom shader files
config.resolver.assetExts.push("frag", "vert", "glsl");

// Support for react-native-skia
config.resolver.sourceExts.push("mjs", "cjs");

// Ensure Three.js works with metro
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return context.resolveRequest(context, "three/src/Three.js", platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Production-only console stripping
config.transformer.minifierConfig = {
  compress: {
    drop_console: process.env.NODE_ENV === "production",
  },
};

// ── react-native-worklets bundle mode config ──────────────────────────────────
// Manually merge instead of using mergeConfig to avoid export issues
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
