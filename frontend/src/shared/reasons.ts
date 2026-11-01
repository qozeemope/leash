const PATTERNS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^Action was triggered by untrusted page\/tool content/i,
    () => "This purchase was triggered by text on a web page, not by you.",
  ],
  [
    /^(\d+) items? exceeds the limit of (\d+)\.?$/i,
    (m) => `The cart has ${m[1]} ${m[1] === "1" ? "item" : "items"}, but your rule allows only ${m[2]}.`,
  ],
  [
    /^Total (\$[\d,.]+) \(\+(\$[\d,.]+) already spent\) exceeds the (\$[\d,.]+) budget\.?$/i,
    (m) => `The total, ${m[1]}, plus ${m[2]} already spent, goes over your ${m[3]} budget.`,
  ],
  [
    /^'(.+)' is category '(.+)', which the mandate does not allow\.?$/i,
    (m) => `${m[1]} is in the \u201C${m[2]}\u201D category, which your rule does not allow.`,
  ],
  [
    /^'(.+)' costs (\$[\d,.]+), above the (\$[\d,.]+) per-item cap\.?$/i,
    (m) => `${m[1]} costs ${m[2]}, more than your ${m[3]} limit for one item.`,
  ],
];

export function plainReason(reason: string): string {
  const text = reason.trim();
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return build(match);
  }
  return text.replace(/\bthe mandate\b/gi, "your rule").replace(/\bmandate\b/gi, "rule");
}
