import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: false,
  target: "node18",
  outDir: "dist",
  tsconfig: "./tsconfig.json",
  platform: "node",
  splitting: false,
  bundle: true,
  external: ["sharp"],
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
    // 强制使用 ESM 格式
    options.format = "esm";
  },
});
