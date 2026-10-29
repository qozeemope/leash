import re

WITHHELD = "[withheld: it contained instruction-like text]"

SUSPICIOUS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"<!--",
        r"\bsystem (?:note|prompt|message|instruction)",
        r"\b(?:note|message|instruction)s? (?:to|for) (?:the )?(?:assistant|ai|agent|model|llm)",
        r"\bignore (?:[\w']+ ){0,3}(?:instructions|rules|limits|budget|constraints)",
        r"\bdisregard\b",
        r"\b(?:complete|finish|proceed with) (?:the )?(?:checkout|purchase)\b",
        r"\bdo not (?:tell|inform|mention)\b",
        r"\byou (?:must|should) (?:now )?(?:add|buy|purchase|checkout)",
    )
]


def looks_like_injection(text: str) -> bool:
    return any(pattern.search(text) for pattern in SUSPICIOUS)
