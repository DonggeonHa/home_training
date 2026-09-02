import { build } from "esbuild"

export async function bundleReactScanLite(outfile) {
  await build({
    bundle: true,
    entryPoints: ["react-scan/lite"],
    format: "iife",
    globalName: "ReactScanLite",
    logLevel: "info",
    outfile,
    platform: "browser",
  })
}
