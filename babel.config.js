// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Path alias: @/ → ./src/
      [
        "module-resolver",
        {
          root: ["./"],
          alias: { "@": "./src" },
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        },
      ],
      "@babel/plugin-proposal-export-namespace-from",
      // react-native-worklets-core must come BEFORE reanimated
      [
        "react-native-worklets-core/plugin",
        // bundleMode + strictGlobal must be configured here, not as a
        // separate standalone plugin object (which causes a Babel parse error)
        // NOTE: bundleMode options are actually metro-level, not babel-level.
        // The babel plugin only accepts: {}
      ],
      // Reanimated must be LAST
      "react-native-reanimated/plugin",
    ],
  };
};
