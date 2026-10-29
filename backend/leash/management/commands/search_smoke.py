import json

from django.core.management.base import BaseCommand, CommandError

from leash import products
from leash.money import money


class Command(BaseCommand):
    help = "Searches the configured product source and prints what the agent would see."

    def add_arguments(self, parser):
        parser.add_argument("query")
        parser.add_argument("--limit", type=int, default=8)
        parser.add_argument("--raw", action="store_true", help="Print the raw Channel3 response for the first results.")

    def handle(self, *args, **options):
        try:
            search = products.get_search()
            if options["raw"]:
                live = getattr(search, "_primary", search)
                if not isinstance(live, products.Channel3Search):
                    raise CommandError("--raw needs PRODUCT_SEARCH_PROVIDER=channel3.")
                data = live.raw_search(options["query"], min(options["limit"], 2))
                self.stdout.write(json.dumps(data, indent=2)[:6000])
                return
            results = search.search(options["query"], options["limit"])
        except (products.SearchUnavailable, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(f"{len(results)} results from {results[0].source if results else 'no source'}")
        for p in results:
            rating = p.merchant_rating if p.merchant_rating is not None else "n/a"
            self.stdout.write(
                f"  {p.id}  {money(p.price_cents):>9}  [{p.category}]  {p.title}  ({p.merchant}, rating {rating})"
            )
            if p.category_path:
                self.stdout.write(f"      {' > '.join(p.category_path)}")
