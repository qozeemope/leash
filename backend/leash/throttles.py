from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class IPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginThrottle(IPRateThrottle):
    scope = "login"


class DemoThrottle(IPRateThrottle):
    scope = "demo"


class ProposeThrottle(UserRateThrottle):
    scope = "propose"


class ParseThrottle(UserRateThrottle):
    scope = "ai_parse"


class AgentRunThrottle(UserRateThrottle):
    scope = "agent_run"
