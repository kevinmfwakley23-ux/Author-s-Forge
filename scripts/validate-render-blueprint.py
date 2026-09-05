#!/usr/bin/env python3
"""Validate render.yaml without requiring Render account credentials.

Uses Render's published JSON Schema for structural validation and adds the
cross-service reference checks this ecosystem depends on.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

SCHEMA_URL = "https://render.com/schema/render.yaml.json"
BLUEPRINT = Path(sys.argv[1] if len(sys.argv) > 1 else "render.yaml")


def fail(message: str) -> None:
    print(f"Render Blueprint validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not BLUEPRINT.is_file():
        fail(f"{BLUEPRINT} does not exist")

    try:
        document = yaml.safe_load(BLUEPRINT.read_text(encoding="utf-8"))
    except Exception as exc:  # PyYAML reports precise line/column information.
        fail(f"invalid YAML: {exc}")

    try:
        with urllib.request.urlopen(SCHEMA_URL, timeout=20) as response:
            schema = json.load(response)
    except Exception as exc:
        fail(f"could not retrieve Render schema: {exc}")

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    if errors:
        for error in errors:
            location = ".".join(str(part) for part in error.absolute_path) or "<root>"
            print(f"{location}: {error.message}", file=sys.stderr)
        raise SystemExit(1)

    services = document.get("services", []) if isinstance(document, dict) else []
    if not services:
        fail("services must contain at least one service")

    service_by_name: dict[str, dict] = {}
    for service in services:
        name = service.get("name")
        if not isinstance(name, str) or not name.strip():
            fail("every service must have a non-empty name")
        if name in service_by_name:
            fail(f"duplicate service name {name!r}")
        service_by_name[name] = service

    for service in services:
        for env_var in service.get("envVars", []) or []:
            source = env_var.get("fromService") if isinstance(env_var, dict) else None
            if not source:
                continue
            source_name = source.get("name")
            if source_name not in service_by_name:
                fail(f"{service['name']}.{env_var.get('key')} references unknown service {source_name!r}")
            expected_type = source.get("type")
            actual_type = service_by_name[source_name].get("type")
            if expected_type and actual_type != expected_type:
                fail(
                    f"{service['name']}.{env_var.get('key')} expects {source_name!r} "
                    f"to be type {expected_type!r}, found {actual_type!r}"
                )

    names = set(service_by_name)
    required = {"kings-ai-router", "authors-forge", "kings-collectors-kingdom"}
    missing = sorted(required - names)
    if missing:
        fail(f"ecosystem blueprint is missing required services: {', '.join(missing)}")

    print(f"Render Blueprint validation passed: {len(services)} services, schema and service references valid.")


if __name__ == "__main__":
    main()
