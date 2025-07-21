import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts", 
    "src/schema.ts", 
    "src/migrations.ts", 
    "src/types.ts",
    "src/validation.ts",
    "src/operations.ts"
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Cloudflare Workers optimizations
  platform: "node",
  target: "es2022",
});
