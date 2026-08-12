import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "functions/**", "graphify-out/**", "next-env.d.ts"],
  },
  {
    rules: {
      // TODO: baja deuda tecnica pendiente de tipar (ver auditoria 2026-08-12).
      // Bajado a warning para poder activar el build gate sin adivinar ~140 tipos de golpe.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
