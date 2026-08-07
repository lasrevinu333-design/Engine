#!/usr/bin/env python3
"""Generate an exact source-bound Engine authority and compatibility inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

TEXT_SUFFIXES = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".json", ".yml", ".yaml", ".gradle", ".java", ".xml", ".md"
}
EXCLUDED_PREFIXES = ("node_modules/", "docs/visual-reference/")

CORE_PATTERNS = {
    "FETCH_CALL": re.compile(r"\bfetch\s*\(\s*([\"'`])([^\"'`]+)\1", re.I),
    "API_WRAPPER_CALL": re.compile(r"\bapi\s*\(\s*([\"'`])([^\"'`]+)\1", re.I),
    "SUPABASE_RPC_CALL": re.compile(r"\b(?:supabase\.)?rpc\s*\(\s*([\"'`])([^\"'`]+)\1", re.I),
    "LOCAL_STORAGE_MUTATION": re.compile(r"\b(localStorage|sessionStorage)\.(setItem|removeItem|clear)\s*\(", re.I),
}

WRITE_WORDS = re.compile(
    r"\b(POST|PUT|PATCH|DELETE|insert|update|delete|upsert|write|submit|save|publish|assign|remove|"
    r"mutateProtectedWork|setItem|removeItem|clear|requestEnvelope)\b",
    re.I,
)

AUTHORITY_WORDS = re.compile(
    r"\b(device|credential|employee|manager|authorization|token|session|epoch|assignment|identity|"
    r"native|vault|security|release|signer|apk|nfc|ndef|gps|notification|messenger|event|schedule)\b",
    re.I,
)

COMPAT_WORDS = re.compile(r"\b(legacy|compat|fallback|scanner|qr|scan\.html|deprecated|retire|rollback|repair|bridge|old)\b", re.I)

NATIVE_PATTERNS = [
    re.compile(r"\b(MemphisCustodialSecurity|MemphisMobile|Capacitor|PushNotifications|LocalNotifications|App\.addListener|Nfc|NFC|NDEF|Device)\b"),
    re.compile(r"\b(authoritativeDeviceId|mutateProtectedWork|waitForStableState|getStatus|deviceId|credentialId|assignmentEpoch)\b"),
]

DIRECT_DB_PATTERN = re.compile(
    r"\.from\s*\(\s*([\"'`])([^\"'`]+)\1\s*\)\s*\.\s*(insert|update|delete|upsert)\s*\(",
    re.I | re.S,
)

NAV_PATTERN = re.compile(
    r"(?:location\.href|window\.location(?:\.href)?|href\s*=|new\s+URL)\s*[^\n]{0,100}?([\"'`])([^\"'`]+\.(?:html|htm)(?:\?[^\"'`]*)?)\1",
    re.I,
)


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, text=True, capture_output=True).stdout


def sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def line_no(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def one_line(text: str, offset: int, width: int = 360) -> str:
    start = max(0, text.rfind("\n", 0, offset) + 1)
    end = text.find("\n", offset)
    if end < 0:
        end = len(text)
    return re.sub(r"\s+", " ", text[start : max(end, min(len(text), start + width))]).strip()[:width]


def stable_id(repo: str, commit: str, path: str, line: int, offset: int, category: str, symbol: str) -> str:
    return "SURF-ENGINE-" + sha("|".join([repo, commit, path, str(line), str(offset), category, symbol]))[:20].upper()


def add(
    entries: list[dict[str, Any]],
    *,
    repo: str,
    commit: str,
    tree: str,
    path: str,
    digest: str,
    text: str,
    offset: int,
    category: str,
    symbol: str,
    method: str | None = None,
    target: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    line = line_no(text, offset)
    context = text[max(0, offset - 180) : min(len(text), offset + 1200)]
    entry: dict[str, Any] = {
        "id": stable_id(repo, commit, path, line, offset, category, symbol),
        "repository": repo,
        "source_commit": commit,
        "source_tree": tree,
        "path": path,
        "file_sha256": digest,
        "line": line,
        "category": category,
        "symbol": symbol,
        "method": method,
        "target": target,
        "source_state": "PRESENT_AT_FROZEN_COMMIT",
        "mutation_class": "MUTATION_CAPABLE" if WRITE_WORDS.search(context) else "READ_OR_PRESENTATION_CANDIDATE",
        "authority_signals": sorted({m.group(0).lower() for m in AUTHORITY_WORDS.finditer(context)}),
        "compatibility_signal": bool(COMPAT_WORDS.search(context)),
        "evidence_excerpt": one_line(text, offset),
        "target_disposition": "COMPATIBILITY_REQUIRES_EXPLICIT_RETIREMENT_OR_BOUNDED_FALLBACK" if COMPAT_WORDS.search(context) else "RESEARCH_REQUIRED",
        "proof_status": "SOURCE_OBSERVED_ONLY_NOT_YET_ADMITTED",
    }
    if extra:
        entry.update(extra)
    entries.append(entry)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    parser.add_argument("--repository", default="lasrevinu333-design/Engine")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    commit = git("rev-parse", f"{args.commit}^{{commit}}").strip()
    if commit != args.commit:
        raise SystemExit(f"commit mismatch: {commit}")
    tree = git("rev-parse", f"{commit}^{{tree}}").strip()
    all_paths = [p for p in git("ls-tree", "-r", "--name-only", commit).splitlines() if p]

    entries: list[dict[str, Any]] = []
    files: list[dict[str, Any]] = []
    observed: Counter[str] = Counter()
    scanned = 0

    for path in all_paths:
        if path.startswith(EXCLUDED_PREFIXES):
            continue
        suffix = Path(path).suffix.lower()
        if suffix not in TEXT_SUFFIXES and not path.startswith(".github/workflows/"):
            continue
        try:
            text = git("show", f"{commit}:{path}")
        except subprocess.CalledProcessError:
            continue
        if "\x00" in text:
            continue
        scanned += 1
        digest = sha(text)
        files.append({"path": path, "sha256": digest, "bytes_utf8": len(text.encode("utf-8"))})

        for category, regex in CORE_PATTERNS.items():
            for match in regex.finditer(text):
                observed[category] += 1
                if category in {"FETCH_CALL", "API_WRAPPER_CALL", "SUPABASE_RPC_CALL"}:
                    symbol = match.group(2)
                    method_match = re.search(r"method\s*:\s*([\"'])(GET|POST|PUT|PATCH|DELETE)\1", text[match.start() : match.start() + 500], re.I)
                    method = method_match.group(2).upper() if method_match else None
                    add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category=category, symbol=symbol, method=method, target=symbol)
                else:
                    symbol = f"{match.group(1)}.{match.group(2)}"
                    add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category=category, symbol=symbol)

        for match in DIRECT_DB_PATTERN.finditer(text):
            observed["DIRECT_DB_MUTATION"] += 1
            table = match.group(2)
            operation = match.group(3).upper()
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category="DIRECT_DB_MUTATION", symbol=f"{operation} {table}", method=operation, target=table)

        for regex in NATIVE_PATTERNS:
            seen: set[tuple[int, str]] = set()
            for match in regex.finditer(text):
                symbol = match.group(1)
                key = (line_no(text, match.start()), symbol)
                if key in seen:
                    continue
                seen.add(key)
                observed["NATIVE_AUTHORITY_SIGNAL"] += 1
                add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category="NATIVE_AUTHORITY_SIGNAL", symbol=symbol)

        for match in NAV_PATTERN.finditer(text):
            observed["NAVIGATION_TARGET"] += 1
            target = match.group(2)
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category="NAVIGATION_TARGET", symbol=target, target=target)

        for regex, category in [
            (re.compile(r"\b(indexedDB\.open|IDBDatabase|IDBObjectStore)\b"), "INDEXED_DB_SURFACE"),
            (re.compile(r"\b(scan\.html|Scanner|QR|BarcodeScanner|NDEF|NFC)\b", re.I), "SCAN_NFC_COMPATIBILITY_SURFACE"),
            (re.compile(r"\b(PushNotifications|LocalNotifications|memphis-alert-tone|speechSynthesis|Notification)\b"), "NOTIFICATION_PRESENTATION_SURFACE"),
            (re.compile(r"\b(release|versionCode|signing|certificate|APK|rollback|Build 22|Fully Kiosk)\b", re.I), "RELEASE_PHYSICAL_SURFACE"),
        ]:
            seen: set[tuple[int, str]] = set()
            for match in regex.finditer(text):
                symbol = match.group(1)
                key = (line_no(text, match.start()), symbol.lower())
                if key in seen:
                    continue
                seen.add(key)
                observed[category] += 1
                add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=match.start(), category=category, symbol=symbol)

        if path.startswith("scripts/") and suffix in {".js", ".mjs", ".cjs", ".ts"}:
            observed["SCRIPT_ENTRYPOINT"] += 1
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=0, category="SCRIPT_ENTRYPOINT", symbol=Path(path).name, extra={"mutation_candidate": bool(WRITE_WORDS.search(text) or re.search(r"build|release|deploy|configure|verify|admit|repair", path, re.I))})

        if path.startswith("mobile/scripts/") and suffix in {".js", ".mjs", ".cjs", ".ts"}:
            observed["NATIVE_BUILD_SCRIPT"] += 1
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=0, category="NATIVE_BUILD_SCRIPT", symbol=Path(path).name, extra={"mutation_candidate": True})

        if path.startswith(".github/workflows/") and suffix in {".yml", ".yaml"}:
            observed["WORKFLOW"] += 1
            name = re.search(r"^name:\s*(.+)$", text, re.M)
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=0, category="WORKFLOW", symbol=(name.group(1).strip() if name else Path(path).name), extra={"mutation_candidate": bool(re.search(r"deploy|build|release|write|configure|repair|migration", text, re.I))})

        if suffix == ".html" and ("/" not in path or path.startswith("mobile/src/")):
            observed["PRODUCT_PAGE"] += 1
            title = re.search(r"<title>(.*?)</title>", text, re.I | re.S)
            add(entries, repo=args.repository, commit=commit, tree=tree, path=path, digest=digest, text=text, offset=0, category="PRODUCT_PAGE", symbol=(re.sub(r"\s+", " ", title.group(1)).strip() if title else path))

    ids = [x["id"] for x in entries]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate stable IDs")

    emitted = Counter(x["category"] for x in entries)
    coverage = {key: {"observed": observed[key], "emitted": emitted[key], "pass": observed[key] == emitted[key]} for key in CORE_PATTERNS}
    coverage["DIRECT_DB_MUTATION"] = {"observed": observed["DIRECT_DB_MUTATION"], "emitted": emitted["DIRECT_DB_MUTATION"], "pass": observed["DIRECT_DB_MUTATION"] == emitted["DIRECT_DB_MUTATION"]}
    if not all(v["pass"] for v in coverage.values()):
        raise SystemExit(f"coverage mismatch: {coverage}")

    minimums = {
        "FETCH_CALL": 10,
        "LOCAL_STORAGE_MUTATION": 10,
        "NATIVE_AUTHORITY_SIGNAL": 20,
        "SCRIPT_ENTRYPOINT": 20,
        "WORKFLOW": 5,
        "PRODUCT_PAGE": 10,
    }
    failed = {k: {"expected_at_least": v, "actual": emitted[k]} for k, v in minimums.items() if emitted[k] < v}
    if failed:
        raise SystemExit(f"inventory unexpectedly shallow: {failed}")

    path_index: dict[str, list[str]] = defaultdict(list)
    for entry in entries:
        path_index[entry["path"]].append(entry["id"])

    package: dict[str, Any] = {
        "protocol": "CUSTODIAL_V43_ENGINE_AUTHORITY_SURFACE_INVENTORY_V1",
        "status": "SOURCE_INVENTORY_COMPLETE_DISPOSITIONS_PENDING_ARCHITECTURE_REVIEW",
        "repository": args.repository,
        "source_commit": commit,
        "source_tree": tree,
        "scanner": {
            "path": "scripts/generate-custodial-v43-engine-authority-inventory.py",
            "mode": "git-object-read-only",
            "working_tree_is_not_source_authority": True,
        },
        "summary": {
            "repository_paths": len(all_paths),
            "text_files_scanned": scanned,
            "files_with_authority_entries": len(path_index),
            "entries": len(entries),
            "categories": dict(sorted(emitted.items())),
        },
        "core_pattern_coverage": coverage,
        "minimum_coverage": {k: {"expected_at_least": v, "actual": emitted[k], "pass": emitted[k] >= v} for k, v in minimums.items()},
        "limitations": [
            "Source presence is not proof of deployed or physical behavior.",
            "Dynamic URLs, generated native source, reflection, provider behavior, and configuration-driven callers require follow-up.",
            "Compatibility signals require explicit target disposition; they are not automatically retained.",
            "No entry is admitted merely because it appears in this inventory."
        ],
        "files": sorted(files, key=lambda x: x["path"]),
        "entries": sorted(entries, key=lambda x: (x["path"], x["line"], x["category"], x["symbol"])),
        "path_index": {k: sorted(v) for k, v in sorted(path_index.items())},
        "acceptance": {
            "exact_repository_commit_bound": True,
            "core_observed_equals_emitted": True,
            "unique_stable_ids": True,
            "downstream_authority": False,
            "next_gate": "architecture_disposition_join_and_deployed_physical_reconciliation"
        }
    }
    canonical = json.dumps(package, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    package["inventory_sha256"] = sha(canonical)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(package, indent=2, sort_keys=True, ensure_ascii=False) + "\n")

    check = json.loads(output.read_text())
    assert check["source_commit"] == commit
    assert check["acceptance"]["downstream_authority"] is False
    print(json.dumps({"status": "PASS", "protocol": package["protocol"], "source_commit": commit, "entries": len(entries), "categories": dict(sorted(emitted.items())), "inventory_sha256": package["inventory_sha256"]}, sort_keys=True))


if __name__ == "__main__":
    main()
