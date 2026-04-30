import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "CodePen/**",
      "next-env.d.ts",
      "public/live2d/js/live2d.js",
      "scripts/**",
      "supabase/**",
      "workers/**",
      "tmp/**",
      "scratch/**",
      ".agents/**",
      ".claude/**",
      ".github/**",
      "MD/**",
      "docs/**",
      "*.md",
      "*.sh",
      "*.py",
      "eslint_output.txt",
      ".vercel/**",
      ".gemini/**",
      "ClaudeDesign/**",
      ".vscode/**",
      ".git/**",
      "genius-worker/.wrangler/**",
    ],
  },
];

export default eslintConfig;
