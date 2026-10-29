"""Local adapter. Python socket audit guard applies to this process only.
Subprocesses do not inherit this guard; this is not an OS network sandbox.
No service is started. Child gate tests require separate source review.
"""
import ast
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys
import socket
import asyncio


def deny_network(event, args):
    if event in {"socket.connect", "socket.connect_ex", "socket.getaddrinfo", "socket.bind"}:
        # Windows asyncio uses a stdlib-created loopback socket pair for wakeups.
        # Permit only that exact caller; ordinary loopback/service sockets stay blocked.
        caller = sys._getframe(1)
        if (event in {"socket.bind", "socket.connect"}
                and caller.f_code is getattr(socket.socketpair, "__code__", None)
                and len(args) > 1 and args[1][0] in {"127.0.0.1", "::1"}):
            return
        raise RuntimeError("Local validation forbids network/database access")


def dependencies():
    names = {"pytest": "pytest", "fastapi": "fastapi", "pydantic": "pydantic", "pymongo": "pymongo", "dotenv": "python-dotenv", "requests": "requests", "uvicorn": "uvicorn"}
    result = {module: importlib.metadata.version(distribution) if importlib.util.find_spec(module) else None for module, distribution in names.items()}
    print(json.dumps(result, sort_keys=True))
    return 0 if all(result.values()) else 2


def contracts(backend):
    # Parse declarations without importing/starting the server.
    source = ast.parse((backend / "server.py").read_text(encoding="utf-8-sig"))
    sys.path.insert(0, str(backend))
    import models
    routes = []
    for function in source.body:
        if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in function.decorator_list:
            if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
                continue
            if not isinstance(decorator.func.value, ast.Name) or decorator.func.value.id != "app":
                continue
            if decorator.func.attr not in {"get", "post", "patch", "delete", "put"} or not decorator.args:
                continue
            if not isinstance(decorator.args[0], ast.Constant):
                raise RuntimeError("Unresolved backend route declaration")
            model = next((arg.annotation.id for arg in function.args.args if arg.arg == "data" and isinstance(arg.annotation, ast.Name)), None)
            schema = getattr(models, model).model_json_schema() if model else None
            routes.append({"method": decorator.func.attr.upper(), "path": decorator.args[0].value, "line": function.lineno, "model": model, "required": schema.get("required", []) if schema else [], "fields": sorted(schema.get("properties", {})) if schema else []})
    print(json.dumps(routes))
    return 0


def main():
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    os.environ["PYTEST_ADDOPTS"] = "-p no:cacheprovider"
    sys.addaudithook(deny_network)
    mode = sys.argv[1]
    if mode == "guard-check":
        async def local_coroutine():
            return "asyncio internal wakeup PASS"
        print(asyncio.run(local_coroutine()))
        for host in ("127.0.0.1", "203.0.113.1"):
            try:
                deny_network("socket.connect", (None, (host, 27017)))
            except RuntimeError:
                continue
            raise RuntimeError("Service connection guard did not reject")
        print("Service/database connection guard PASS")
        return 0
    if mode == "dependencies":
        return dependencies()
    backend = Path(sys.argv[2]).resolve(strict=True)
    expected_backend = Path(__file__).resolve().parents[3] / "backend"
    if backend != expected_backend:
        raise RuntimeError("Use the repository authoritative backend directory")
    if mode == "contracts":
        return contracts(backend)
    if mode != "tests":
        raise RuntimeError("Unknown mode")
    os.chdir(backend)
    sys.path.insert(0, str(backend))
    import pytest
    # Keep all deterministic tests, including validation-gate tests; do not hide missing resources.
    return pytest.main(["tests", "-m", "not integration", "-q", "-p", "no:cacheprovider"])


if __name__ == "__main__":
    raise SystemExit(main())
