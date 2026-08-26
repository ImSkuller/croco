import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src-tauri/target (Rust build output — can contain generated .js assets
  // once a release bundle has been built, e.g. tauri-codegen-assets) has no
  // lintable app source; without this it gets crawled alongside real code.
  globalIgnores(['dist', 'src-tauri/target', 'src-tauri/gen', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // The `pm`/`croco` CLIs (cli/*.js) are plain Node scripts, not browser
    // React code — they need Node globals (process, __dirname, ...) instead
    // of/in addition to the browser globals above.
    files: ['cli/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
