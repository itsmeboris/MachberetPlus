import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
export default function setup() {
  const cli = resolve("node_modules/wrangler/bin/wrangler.js");
  for (const args of [
    ["d1", "migrations", "apply", "machberet-pilot", "--local"],
    [
      "d1",
      "execute",
      "machberet-pilot",
      "--local",
      "--command",
      "DELETE FROM rate_limits",
    ],
  ]) {
    execFileSync(
      process.execPath,
      [cli, ...args, "--persist-to", ".wrangler/e2e"],
      { stdio: "pipe", env: { ...process.env, CI: "true" } },
    );
  }
}
