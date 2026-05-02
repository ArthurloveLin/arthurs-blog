import path from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const workersEslintConfig = [
  {
    files: [
      "workers/cloudflare-worker/src/**/*.ts",
      "workers/engagement-worker/src/**/*.ts",
      "workers/genius-worker/src/**/*.ts",
      "workers/spotify-now-playing-worker/src/**/*.ts",
      "workers/wardrobe-supabase-worker/src/**/*.ts",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];

export default workersEslintConfig;