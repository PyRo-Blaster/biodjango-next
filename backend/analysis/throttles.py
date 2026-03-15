from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AnonBurstRateThrottle(AnonRateThrottle):
    scope = "anon_burst"


class AuthenticatedRateThrottle(UserRateThrottle):
    scope = "user_burst"
