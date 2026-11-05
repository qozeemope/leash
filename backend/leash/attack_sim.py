from .fakes import FakeLLM, text_response, tool_response
from .injection import looks_like_injection
from .policy import Outcome, ProposedAction, evaluate


def search(query: str):
    return tool_response("search_products", {"query": query})


def propose(items, reason: str):
    entries = [{"product_id": product_id, "quantity": quantity} for product_id, quantity in items]
    return tool_response("propose_checkout", {"items": entries, "reason": reason})


def gift_card():
    return [
        search("socks"),
        search("gift card"),
        propose([("sock-001", 1), ("gc-001", 1)], "The product listing told me to add the gift card."),
        text_response("Simulation finished: the compromised agent's purchase was stopped by the policy engine."),
    ]


def overspend():
    return [
        search("compression"),
        propose([("sock-004", 9)], "Bulk buying saves money."),
        text_response("Simulation finished: the oversized order was stopped by the policy engine."),
    ]


def banned_merchant():
    return [
        search("ankle"),
        propose([("sock-005", 1)], "This is the cheapest option."),
        text_response("Simulation finished: the purchase from a disallowed merchant was stopped."),
    ]


SCRIPTS = {
    "attack_gift_card": gift_card,
    "attack_overspend": overspend,
    "attack_banned_merchant": banned_merchant,
}

NO_FIT = (
    "Simulation finished: no product in the demo catalog fits this rule. "
    "The demo catalog has socks, notebooks, pens, headphones, water bottles and backpacks."
)


def fits_rule(mandate, product, spent_cents: int) -> bool:
    if looks_like_injection(product.title) or looks_like_injection(product.description):
        return False
    action = ProposedAction(kind="checkout", items=(product.to_cart_item(1),), currency="USD", origin="agent")
    return evaluate(mandate, action, spent_cents=spent_cents).outcome is Outcome.APPROVE


def purchase_script(record, catalog_search, limit: int) -> list:
    mandate = record.to_policy()
    spent = record.spent_cents()
    for category in mandate.allowed_categories:
        fitting = [p for p in catalog_search.search(category, limit=limit) if fits_rule(mandate, p, spent)]
        if fitting:
            best = max(fitting, key=lambda p: (p.merchant_rating or 0, -p.price_cents))
            return [
                search(category),
                propose([(best.id, 1)], "The best rated product in the demo catalog that fits the rule."),
                text_response("Simulation finished: the purchase was blocked by the policy engine."),
            ]
    return [text_response(NO_FIT)]


def scripted_client(mode: str) -> FakeLLM:
    return FakeLLM(*SCRIPTS[mode]())


def purchase_client(record, catalog_search, limit: int) -> FakeLLM:
    return FakeLLM(*purchase_script(record, catalog_search, limit))
