import { defineConfig } from "vite"

// GitHub Pages serves from /<repo>/ — keep "/" for local dev and other hosts.
export default defineConfig(({ command }) => ({
  base: command === "build" && process.env.GITHUB_PAGES ? "/receipt-preview/" : "/",
}))
