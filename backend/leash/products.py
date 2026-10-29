import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import requests
from django.conf import settings

from .money import dollars_to_cents
from .policy import CartItem

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_CHARS = 500


class SearchUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Product:
    id: str
    title: str
    category: str
    price_cents: int
    currency: str
    merchant: str
    url: str = ""
    description: str = ""
    merchant_rating: float | None = None
    delivery_days: int | None = None
    source: str = "seeded"
    category_path: tuple[str, ...] = ()

    def to_cart_item(self, quantity: int = 1) -> CartItem:
        return CartItem(
            title=self.title,
            category=self.category,
            unit_price_cents=self.price_cents,
            quantity=quantity,
            merchant=self.merchant,
            merchant_rating=self.merchant_rating,
            delivery_days=self.delivery_days,
            category_path=self.category_path,
        )


class ProductSearch(Protocol):
    def search(self, query: str, limit: int = 10) -> list[Product]: ...


def category_name(entry) -> str:
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict):
        return str(entry.get("name") or entry.get("id") or "")
    return ""


def parse_category(item: dict) -> tuple[str, tuple[str, ...]]:
    category = item.get("category")
    if isinstance(category, dict):
        nodes = category.get("path") or []
        path = tuple(
            name
            for name in (str(n.get("title") or n.get("slug") or "").strip().lower() for n in nodes if isinstance(n, dict))
            if name
        )
        leaf = str(category.get("title") or category.get("slug") or "").strip().lower() or (path[-1] if path else "")
        if leaf:
            return leaf, path
    names = [name.strip().lower() for name in (category_name(c) for c in item.get("categories") or []) if name.strip()]
    if names:
        return names[-1], tuple(names)
    return "uncategorized", ()


def best_offer(offers: list) -> tuple[dict, int] | None:
    candidates = []
    for offer in offers:
        if not isinstance(offer, dict) or offer.get("availability") != "InStock":
            continue
        price = offer.get("price")
        if not isinstance(price, dict) or str(price.get("currency", "USD")).upper() != "USD":
            continue
        cents = dollars_to_cents(price.get("price", price.get("amount")))
        if cents is not None:
            candidates.append((cents, offer))
    if not candidates:
        return None
    cents, offer = min(candidates, key=lambda pair: pair[0])
    return offer, cents


def parse_product(item: dict) -> Product | None:
    if not isinstance(item, dict) or not item.get("id") or not item.get("title"):
        return None
    chosen = best_offer(item.get("offers") or [])
    if chosen is None:
        return None
    offer, cents = chosen

    category, category_path = parse_category(item)
    description = item.get("description")
    return Product(
        id=str(item["id"]),
        title=str(item["title"]),
        category=category,
        price_cents=cents,
        currency="USD",
        merchant=str(offer.get("domain") or "unknown"),
        url=str(offer.get("url") or ""),
        description=description[:MAX_DESCRIPTION_CHARS] if isinstance(description, str) else "",
        source="channel3",
        category_path=category_path,
    )


class Channel3Search:
    def __init__(self, api_key: str, timeout_seconds: float, base_url: str = "https://api.trychannel3.com"):
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._base_url = base_url

    def raw_search(self, query: str, limit: int) -> dict:
        try:
            response = requests.post(
                f"{self._base_url}/v1/search",
                json={"query": query, "limit": max(1, min(limit, 30))},
                headers={"x-api-key": self._api_key},
                timeout=self._timeout,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning("Channel3 search failed: %r", exc)
            raise SearchUnavailable("Product search is unavailable.") from exc

    def search(self, query: str, limit: int = 10) -> list[Product]:
        data = self.raw_search(query, limit)
        items = data.get("products") if isinstance(data, dict) else None
        parsed = (parse_product(item) for item in items or [])
        return [product for product in parsed if product is not None][:limit]


class FallbackSearch:
    def __init__(self, primary: ProductSearch, fallback: ProductSearch):
        self._primary = primary
        self._fallback = fallback

    def search(self, query: str, limit: int = 10) -> list[Product]:
        try:
            return self._primary.search(query, limit)
        except SearchUnavailable:
            logger.warning("Primary product search failed; using the seeded catalog.")
            return self._fallback.search(query, limit)


STOPWORDS = {"a", "an", "the", "of", "for", "some", "and", "or", "to", "up", "under", "over", "with", "me", "my", "i", "buy", "find"}


def tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    stems = {w[:-1] if len(w) > 3 and w.endswith("s") else w for w in words if not w.isdigit()}
    return stems - STOPWORDS


class SeededSearch:
    def __init__(self, catalog: list[Product]):
        self._catalog = catalog

    def search(self, query: str, limit: int = 10) -> list[Product]:
        wanted = tokenize(query)
        scored = []
        for product in self._catalog:
            score = len(wanted & tokenize(f"{product.title} {product.category}"))
            if score:
                scored.append((-score, product.price_cents, product.id, product))
        scored.sort(key=lambda row: row[:3])
        return [row[3] for row in scored[:limit]]


@lru_cache(maxsize=1)
def get_search() -> ProductSearch:
    from .seed_catalog import CATALOG

    seeded = SeededSearch(CATALOG)
    if settings.PRODUCT_SEARCH_PROVIDER == "seeded":
        return seeded
    if settings.PRODUCT_SEARCH_PROVIDER != "channel3":
        raise ValueError(f"Unsupported product search provider: {settings.PRODUCT_SEARCH_PROVIDER}")
    if not settings.CHANNEL3_API_KEY:
        raise ValueError("CHANNEL3_API_KEY is required when PRODUCT_SEARCH_PROVIDER is channel3.")
    live = Channel3Search(settings.CHANNEL3_API_KEY, settings.PRODUCT_SEARCH_TIMEOUT_SECONDS)
    return FallbackSearch(live, seeded)
