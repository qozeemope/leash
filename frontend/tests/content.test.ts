import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const root = new URL("../", import.meta.url).pathname;
const sources = [...walk(join(root, "src")).filter((p) => /\.(tsx?|css)$/.test(p)), join(root, "index.html")];
const files = sources.map((path) => ({ path: path.replace(root, ""), text: readFileSync(path, "utf8") }));

const FORBIDDEN = [
  "oops",
  "uh-oh",
  "hurray",
  "success!",
  "successfully",
  "it looks like",
  "we are working on it",
  "something went wrong",
];

test("no emoji, pictographs or symbol characters in the interface", () => {
  const symbol = /\p{Extended_Pictographic}|[\u2190-\u2BFF]|[\u{1F000}-\u{1FAFF}]/u;
  const escaped = /\\u(?:2[1-9A-B][0-9A-Fa-f]{2})|\\u\{1[Ff][0-9A-Fa-f]{3}\}/;
  for (const file of files) {
    assert.equal(symbol.test(file.text), false, `${file.path} contains a symbol or emoji character`);
    assert.equal(escaped.test(file.text), false, `${file.path} contains an escaped symbol or emoji`);
  }
});

test("no forbidden phrases in user-facing copy", () => {
  for (const file of files) {
    const lower = file.text.toLowerCase();
    for (const phrase of FORBIDDEN) assert.equal(lower.includes(phrase), false, `${file.path} contains "${phrase}"`);
  }
});

test("no exclamation points in user-facing text", () => {
  const sentence = /[A-Za-z)]!(?=[\s"'`<])/;
  for (const file of files) {
    for (const [index, line] of file.text.split("\n").entries()) {
      assert.equal(sentence.test(line), false, `${file.path}:${index + 1} has an exclamation point: ${line.trim()}`);
    }
  }
});

test("small buttons keep a 44px tap target", () => {
  const css = files.find((file) => file.path.endsWith("retro.css"))?.text ?? "";
  const small = /\.btn-small\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
  assert.ok(small.length > 0);
  assert.equal(/min-height/.test(small), false, "btn-small must not override the 44px min-height");
});
