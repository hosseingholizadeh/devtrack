// PreToolUse guardrail: block access to secret files (.env*, credentials) via any tool.
// Exit 2 = block the call and show stderr to Claude. Allows .env.example/.sample/.template.
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // never break the session on malformed input
}

const ti = input.tool_input ?? {};
const haystack = [ti.file_path, ti.path, ti.command, ti.pattern].filter(Boolean).join("\n");

const SAFE = /\.env\.(example|sample|template)\b/gi;
const cleaned = haystack.replace(SAFE, "");
const secret = /(^|[\\/\s"'=:])\.env(\.[\w.-]+)?(?=$|[\\/\s"';&|)])|\.credentials\.json|\.(pem|key)(?=$|[\s"';&|)])|id_(rsa|ed25519)/i;

if (secret.test(cleaned)) {
  console.error(
    "Blocked by protect-secrets hook: this touches a secret/credential file (.env*, credentials, keys). " +
      "Ask the user to provide the needed non-secret value instead.",
  );
  process.exit(2);
}
