from slowapi import Limiter
from starlette.requests import Request


def _get_real_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host or "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)
