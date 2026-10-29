from decimal import ROUND_HALF_UP, Decimal, InvalidOperation


def money(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"


def dollars_to_cents(value) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        return None
    if not amount.is_finite() or amount <= 0:
        return None
    return int((amount * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
