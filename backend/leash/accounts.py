DEMO_PREFIX = "demo_"


def is_demo(user) -> bool:
    return user.username.startswith(DEMO_PREFIX)
