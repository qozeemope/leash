import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrastRatio, isWebSafe, parseHex } from "../src/shared/a11y/contrast.ts";

const css = readFileSync(new URL("../src/styles/retro.css", import.meta.url), "utf8");
const rootMatch = /:root\s*\{([^}]*)\}/.exec(css);
const rootBlock = rootMatch?.[1] ?? "";
const rest = css.replace(/:root\s*\{[^}]*\}/, "");

function tokens(): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of rootBlock.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    const name = m[1];
    const value = m[2];
    if (name && value) map.set(name, value);
  }
  return map;
}

test("every colour token is on the web-safe 216 palette", () => {
  const all = tokens();
  assert.ok(all.size > 0);
  for (const [name, value] of all) assert.ok(isWebSafe(value), `--${name} ${value} is not web-safe`);
});

test("hex colours appear only inside :root", () => {
  assert.equal(/#[0-9a-fA-F]{3,6}\b/.test(rest.replace(/@import[^;]*;/g, "")), false);
});

test("no rgb(), hsl() or oklch() colours in rules", () => {
  assert.equal(/\b(rgba?|hsla?|oklch|oklab)\(/.test(rest), false);
});

test("text and surface pairs meet WCAG AA (4.5:1)", () => {
  const t = tokens();
  const pairs: [string, string][] = [
    ["ink", "wall"], ["ink", "paper"], ["paper", "navy"], ["ink", "gold"],
    ["link", "wall"], ["link", "paper"], ["visited", "paper"], ["paper", "navy-hi"],
    ["ink", "sky"], ["ink", "mist"], ["ink", "face"], ["deep", "paper"],
    ["paper", "approve"], ["approve-ink", "approve-bg"], ["approve", "paper"],
    ["escalate-ink", "escalate-bg"], ["paper", "escalate"],
    ["paper", "block"], ["block-ink", "block-bg"], ["block", "paper"],
    ["paper", "sale"], ["paper", "ink"], ["gold", "ink"], ["mist", "navy"],
  ];
  for (const [fg, bg] of pairs) {
    const a = parseHex(t.get(fg) ?? "");
    const b = parseHex(t.get(bg) ?? "");
    assert.ok(a && b, `missing token ${fg} or ${bg}`);
    const ratio = contrastRatio(a, b);
    assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
  }
});
