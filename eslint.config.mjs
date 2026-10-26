import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

const config = [
  { ignores: [".next/**", "node_modules/**", "src/data/generated/**"] },
  ...next,
  prettier,
  {
    rules: {
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Build scripts report what they generated; that is their output, not a stray log.
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  {
    // The domain layer is pure: no I/O, no framework, no adapters. Its tests are not,
    // because some of them assert the rules against the real export on disk.
    files: ["src/domain/**/*.ts"],
    ignores: ["src/domain/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-*"],
              message: "src/domain must stay framework-free.",
            },
            {
              group: ["@/adapters/*", "@/server/*", "@/app/*", "@/components/*"],
              message: "src/domain must not depend on I/O layers.",
            },
          ],
          paths: [
            { name: "node:fs", message: "src/domain must stay pure: no I/O." },
            { name: "node:crypto", message: "src/domain must stay pure: no I/O." },
          ],
        },
      ],
    },
  },
];

export default config;
