import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { readFileSync } from "node:fs";
import esbuild from "rollup-plugin-esbuild";

const dev = process.env.ROLLUP_WATCH === "true";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default {
  input: "src/polar-clock-card.ts",
  output: {
    file: "dist/polar-clock-card.js",
    format: "es",
    sourcemap: dev,
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    esbuild({
      target: "es2021",
      tsconfig: "tsconfig.json",
      define: { __VERSION__: JSON.stringify(version) },
    }),
    !dev && terser({ format: { comments: false } }),
  ],
};
