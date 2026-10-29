"""ContextDrift root entrypoint.

Allows running either:
    uvicorn app.main:app --reload
or:
    uvicorn main:app --reload
"""
from app.main import app, build_services, svc_of

__all__ = ["app", "build_services", "svc_of"]
