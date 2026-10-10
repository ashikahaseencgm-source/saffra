module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { browser: true, es2022: true },
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "react-hooks/rules-of-hooks": "error",
  },
  ignorePatterns: ["dist", "node_modules"],
};
