// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    // Use the TypeScript resolver (instead of the plain `node` resolver from
    // eslint-config-expo) so packages exposing `exports` maps with a `source`
    // condition — e.g. @react-native-async-storage/async-storage — resolve
    // correctly. The node resolver reports import/no-unresolved for them.
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  }
]);
