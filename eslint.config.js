import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Components/constants referenced only from JSX shouldn't read as unused.
      // (TS-aware version; underscore-prefixed args are intentionally ignored.)
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
      ],
      // Unidirectional codebase (bulletproof-react): low-level layers must not
      // reach "up" into higher ones. Keeps the dependency flow:
      //   config / lib / utils  ->  hooks  ->  components  ->  app
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Nothing outside app/ may import from app/ (it's the top layer).
            {
              target: [
                "./src/components",
                "./src/hooks",
                "./src/lib",
                "./src/utils",
                "./src/config",
                "./src/assets",
              ],
              from: "./src/app",
              message: "Shared layers must not import from app/ - keep the flow shared -> app.",
            },
            // The non-UI core (config/lib/utils) must not depend on React layers.
            {
              target: ["./src/config", "./src/lib", "./src/utils"],
              from: ["./src/components", "./src/hooks"],
              message:
                "config/lib/utils are framework-agnostic - don't import components or hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["test/**"],
    languageOptions: { globals: globals.node },
  },
  // Must be last: disables any ESLint rules that would conflict with Prettier.
  // Formatting is Prettier's job; ESLint here only checks correctness/quality.
  prettier,
);
