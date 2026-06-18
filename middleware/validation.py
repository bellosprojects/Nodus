from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class ValidationMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):

        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                if len(body) > 1024 * 1024: #1MB
                    raise HTTPException(413, "Payload too large")
            except:
                pass

        response = await call_next(request)
        return response