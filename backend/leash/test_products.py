from types import SimpleNamespace
from unittest.mock import patch

import requests
from django.test import SimpleTestCase, override_settings

from . import products
from .money import dollars_to_cents, money
from .products import (
    Channel3Search,
    FallbackSearch,
    Product,
    SearchUnavailable,
    SeededSearch,
    best_offer,
    parse_product,
)
from .seed_catalog import CATALOG


def offer(price, domain="shop.com", availability="InStock", currency="USD", key="price"):
    return {"domain": domain, "url": f"https://{domain}/x", "availability": availability,
            "price": {key: price, "currency": currency}}


def raw_product(**overrides):
    base = {"id": "p1", "title": "Trail running socks", "categories": [{"name": "Socks"}],
            "offers": [offer(18)]}
    base.update(overrides)
    return base


class MoneyTests(SimpleTestCase):
    def test_dollars_convert_to_exact_cents(self):
        self.assertEqual(dollars_to_cents(19.99), 1999)
        self.assertEqual(dollars_to_cents("60"), 6000)
        self.assertIsNone(dollars_to_cents(0))
        self.assertIsNone(dollars_to_cents(True))

    def test_cents_format_as_dollars(self):
        self.assertEqual(money(123456), "$1,234.56")
        self.assertEqual(money(5), "$0.05")


class ParseProductTests(SimpleTestCase):
    def test_a_normal_product_is_converted(self):
        product = parse_product(raw_product())
        self.assertEqual((product.id, product.price_cents, product.category), ("p1", 1800, "socks"))
        self.assertEqual((product.merchant, product.source), ("shop.com", "channel3"))

    def test_both_documented_price_shapes_are_understood(self):
        offers = [offer(18, key="amount")]
        self.assertEqual(parse_product(raw_product(offers=offers)).price_cents, 1800)

    def test_the_cheapest_in_stock_us_dollar_offer_wins(self):
        offers = [
            offer(30, domain="pricey.com"),
            offer(12, domain="gone.com", availability="OutOfStock"),
            offer(10, domain="euro.com", currency="EUR"),
            offer(20, domain="cheap.com"),
        ]
        chosen, cents = best_offer(offers)
        self.assertEqual((chosen["domain"], cents), ("cheap.com", 2000))

    def test_products_without_a_usable_offer_are_dropped(self):
        self.assertIsNone(parse_product(raw_product(offers=[])))
        self.assertIsNone(parse_product(raw_product(offers=[offer(5, availability="OutOfStock")])))

    def test_malformed_items_are_dropped_not_fatal(self):
        for bad in (None, "text", {}, {"id": "x"}, {"title": "y"}):
            with self.subTest(bad=bad):
                self.assertIsNone(parse_product(bad))

    def test_category_uses_the_deepest_name_in_lowercase(self):
        item = raw_product(categories=["Apparel", {"name": "Running Socks"}])
        self.assertEqual(parse_product(item).category, "running socks")

    def test_channel3_category_object_provides_the_leaf_and_the_full_path(self):
        category = {
            "title": "Athletic Socks",
            "path": [{"title": "Apparel & Accessories"}, {"title": "Socks"}, {"title": "Athletic Socks"}],
        }
        product = parse_product(raw_product(categories=None, category=category))
        self.assertEqual(product.category, "athletic socks")
        self.assertEqual(product.category_path, ("apparel & accessories", "socks", "athletic socks"))

    def test_a_channel3_product_in_the_socks_branch_passes_a_socks_mandate(self):
        category = {"title": "Athletic Socks", "path": [{"title": "Clothing"}, {"title": "Socks"}, {"title": "Athletic Socks"}]}
        product = parse_product(raw_product(categories=None, category=category))
        self.assertIn("socks", product.to_cart_item().category_path)

    def test_missing_category_fails_closed(self):
        self.assertEqual(parse_product(raw_product(categories=[])).category, "uncategorized")

    def test_long_descriptions_are_truncated(self):
        item = raw_product(description="x" * 5000)
        self.assertEqual(len(parse_product(item).description), 500)

    def test_product_converts_to_a_cart_item(self):
        cart_item = Product("a", "Socks", "socks", 1800, "USD", "runco.com", merchant_rating=4.5).to_cart_item(2)
        self.assertEqual((cart_item.unit_price_cents, cart_item.quantity, cart_item.merchant), (1800, 2, "runco.com"))


class Channel3SearchTests(SimpleTestCase):
    def make_search(self):
        return Channel3Search(api_key="secret-key", timeout_seconds=5)

    def reply(self, payload, status=200):
        def raise_for_status():
            if status >= 400:
                raise requests.HTTPError(response=SimpleNamespace(status_code=status))
        return SimpleNamespace(raise_for_status=raise_for_status, json=lambda: payload)

    def test_request_is_built_correctly_and_results_are_parsed(self):
        with patch("leash.products.requests.post", return_value=self.reply({"products": [raw_product()]})) as post:
            results = self.make_search().search("running socks", limit=5)
        self.assertEqual([p.id for p in results], ["p1"])
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.trychannel3.com/v1/search")
        self.assertEqual(kwargs["headers"], {"x-api-key": "secret-key"})
        self.assertEqual(kwargs["json"], {"query": "running socks", "limit": 5})
        self.assertEqual(kwargs["timeout"], 5)

    def test_limit_is_capped_at_the_providers_maximum(self):
        with patch("leash.products.requests.post", return_value=self.reply({"products": []})) as post:
            self.make_search().search("socks", limit=500)
        self.assertEqual(post.call_args.kwargs["json"]["limit"], 30)

    def test_network_errors_http_errors_and_bad_json_all_become_search_unavailable(self):
        bad_json = SimpleNamespace(raise_for_status=lambda: None, json=lambda: (_ for _ in ()).throw(ValueError()))
        cases = [
            {"side_effect": requests.ConnectionError()},
            {"return_value": self.reply({}, status=500)},
            {"return_value": bad_json},
        ]
        for case in cases:
            with self.subTest(case=list(case)):
                with patch("leash.products.requests.post", **case):
                    with self.assertRaises(SearchUnavailable):
                        self.make_search().search("socks")

    def test_unexpected_response_shapes_yield_no_results(self):
        with patch("leash.products.requests.post", return_value=self.reply(["not", "a", "dict"])):
            self.assertEqual(self.make_search().search("socks"), [])


class SeededSearchTests(SimpleTestCase):
    def setUp(self):
        self.search = SeededSearch(CATALOG)

    def test_matching_products_come_back_best_match_first(self):
        results = self.search.search("running socks")
        self.assertEqual(results[0].id, "sock-001")
        self.assertTrue(all(p.category == "socks" for p in results))

    def test_plural_and_singular_queries_match_the_same_products(self):
        self.assertEqual(
            [p.id for p in self.search.search("sock")], [p.id for p in self.search.search("socks")]
        )

    def test_price_words_and_numbers_do_not_confuse_matching(self):
        self.assertEqual(self.search.search("notebooks under 20")[0].category, "notebooks")

    def test_unknown_queries_return_nothing(self):
        self.assertEqual(self.search.search("submarine"), [])

    def test_results_are_deterministic_and_respect_the_limit(self):
        first = self.search.search("socks", limit=3)
        self.assertEqual(len(first), 3)
        self.assertEqual(first, self.search.search("socks", limit=3))

    def test_the_catalog_contains_the_demo_attack_and_a_banned_merchant(self):
        by_id = {p.id: p for p in CATALOG}
        self.assertIn("SYSTEM NOTE", by_id["sock-002"].description)
        self.assertEqual(by_id["gc-001"].category, "gift cards")
        self.assertEqual(by_id["sock-005"].merchant, "sketchyshop.com")

    def test_every_seeded_product_has_rating_and_delivery_data(self):
        self.assertTrue(all(p.merchant_rating is not None and p.delivery_days is not None for p in CATALOG))


class FallbackSearchTests(SimpleTestCase):
    class Broken:
        def search(self, query, limit=10):
            raise SearchUnavailable("down")

    class Empty:
        def search(self, query, limit=10):
            return []

    def test_an_outage_switches_to_the_seeded_catalog(self):
        results = FallbackSearch(self.Broken(), SeededSearch(CATALOG)).search("socks")
        self.assertTrue(results and all(p.source == "seeded" for p in results))

    def test_a_genuinely_empty_answer_is_not_replaced(self):
        self.assertEqual(FallbackSearch(self.Empty(), SeededSearch(CATALOG)).search("socks"), [])


class FactoryTests(SimpleTestCase):
    def setUp(self):
        products.get_search.cache_clear()
        self.addCleanup(products.get_search.cache_clear)

    @override_settings(PRODUCT_SEARCH_PROVIDER="seeded")
    def test_seeded_mode_needs_no_key(self):
        self.assertIsInstance(products.get_search(), SeededSearch)

    @override_settings(PRODUCT_SEARCH_PROVIDER="channel3", CHANNEL3_API_KEY="", PRODUCT_SEARCH_TIMEOUT_SECONDS=5)
    def test_live_mode_without_a_key_is_an_error(self):
        with self.assertRaises(ValueError):
            products.get_search()

    @override_settings(PRODUCT_SEARCH_PROVIDER="channel3", CHANNEL3_API_KEY="k", PRODUCT_SEARCH_TIMEOUT_SECONDS=5)
    def test_live_mode_falls_back_to_the_seeded_catalog(self):
        self.assertIsInstance(products.get_search(), FallbackSearch)

    @override_settings(PRODUCT_SEARCH_PROVIDER="nonsense")
    def test_unknown_provider_is_an_error(self):
        with self.assertRaises(ValueError):
            products.get_search()
