# Security notes

Leash is a hackathon project that uses PayPal sandbox accounts only. No real money moves. This page lists what the design protects against, what was checked and when, and what is deliberately left undone.

## How the design limits damage

- **The AI never holds spending authority.** The model can only propose products by ID from its own search results. A deterministic policy engine with no AI and no network access approves, escalates or blocks every proposal, and the server looks up real prices itself.
- **Text from web pages is untrusted.** A proposal triggered by suspicious page content is marked as untrusted and blocked by its own rule, independent of the other limits.
- **Limits cannot be altered after signing.** A confirmed mandate is signed with HMAC-SHA256 using a dedicated key, separate from Django's secret key, and verified with a constant-time comparison.
- **Money is handled in integer cents.** There are no floats anywhere near amounts.
- **Parallel requests cannot overspend.** Proposals lock the mandate row inside a database transaction and reserve a pending order before PayPal is called.
- **Capture cannot double-charge.** Capture uses a compare-and-set status change and a stable idempotency key.
- **Abandoned checkouts release their budget.** Unapproved orders expire, and late captures are refused.
- **Every record is scoped to its owner.** Another user's mandate, run or order returns a not-found response.
- **Sessions and CSRF.** Session cookies use SameSite=Lax, and CSRF protection applies to every unsafe method.
- **Rate limits** apply to the expensive endpoints (rule parsing, proposals and agent runs).
- **Errors are safe.** The API returns one error shape with user-safe messages and no stack traces. The interface never shows raw error details by default.
- **Demo accounts are isolated.** Each visitor gets a throwaway account with no usable password, and stale ones are purged by a management command.
- **The PayPal link is checked.** The interface only follows a payment link if it is an https PayPal address.

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository (Security tab, then Report a vulnerability). Please do not open a public issue for security problems.

## Checks run (1 November 2026)

| Check                                                 | Result                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend dependency audit (`npm audit --omit=dev`)    | 0 vulnerabilities                                                                                                            |
| Backend dependency audit (`pip-audit`)                | No known vulnerabilities                                                                                                     |
| Real `.env` file in git                               | Never committed. Only `.env.example` is tracked                                                                              |
| Keys in git history                                   | Searched for the PayPal and Gemini key prefixes: not found                                                                   |
| Django deployment check (`check --deploy`, debug off) | 2 optional warnings, listed below                                                                                            |
| Frontend code scan                                    | No `innerHTML`, `eval`, hard-coded secrets or insecure URLs. Only temporary checkout notes are stored in the browser session |
| Automated tests                                       | Backend and frontend suites run in GitHub Actions on every push                                                              |

## Known gaps

- **HSTS subdomains and preload** are not enabled. They are hard to undo and need a custom domain.
- **Content Security Policy** is not enforced yet.
- **No penetration test** or independent review has been done.
- **No key rotation process.** Secrets live in environment variables and would be replaced by hand.
- **PCI and KYC** are out of scope. PayPal handles card data on its own pages, and this project uses sandbox money only.
- **Webhook verification** is not implemented. Payment status comes from PayPal's capture response, which is acceptable for a sandbox demo.
- **Single mandate per run, no spending velocity limits.** These are listed as future work in the project proposal.
