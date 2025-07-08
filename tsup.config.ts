import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  target: "node18",
  outDir: "dist",
  tsconfig: "./tsconfig.json",
  esbuildOptions(options) {
    // 支持路径别名
    options.alias = {
      "@": "./src",
    };
  },
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
