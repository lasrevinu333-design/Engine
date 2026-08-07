#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT = Path("docs/audits/custodial-unified-v4-3-architecture/record-envelope-canonicalization")
CONTRACT = ROOT / "record-envelope-contract.json"
SCHEMA = ROOT / "record-envelope-contract.schema.json"
VALIDATOR = ROOT / "validate-record-envelope-canonicalization.mjs"
README = ROOT / "README.md"
RESEARCH = ROOT / "research-plan-audit-replan.md"
V2 = ROOT / "validate-record-envelope-adversarial-v2.mjs"


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
fields = contract["envelope"]["fields"]
if not any(field["name"] == "domain_payload" for field in fields):
    insert_at = next(i for i, field in enumerate(fields) if field["name"] == "source_bytes_digest")
    fields.insert(
        insert_at,
        {
            "name": "domain_payload",
            "json_type": "object",
            "presence": "wire_required",
            "condition": None,
            "semantics": (
                "Canonical domain-specific payload object. Domain extensions are confined here; "
                "unregistered top-level fields are forbidden."
            ),
            "immutable": True,
        },
    )

contract["canonical_json"]["integers"] = {
    "representation": "JSON number",
    "syntax": "^-?(0|[1-9][0-9]*)$",
    "safe_min": -9007199254740991,
    "safe_max": 9007199254740991,
    "exponent": "forbidden",
    "negative_zero": "forbidden",
}
service_time = contract["canonical_json"]["service_time"]
service_time["ruleset_revision"] = "america-chicago-us-2007-2037.v1"
service_time["supported_year_range"] = [2007, 2037]
for attack in [
    "unknown_top_level_field",
    "integer_exponent_or_unsafe_range",
    "invalid_service_date",
    "service_time_ruleset_drift",
    "inactive_conditional_field_present",
    "multi_record_lineage_cycle",
    "whole_record_non_nfc",
    "all_required_positive_fixtures_executed",
]:
    if attack not in contract["conformance"]["required_negative_attacks"]:
        contract["conformance"]["required_negative_attacks"].append(attack)
write_json(CONTRACT, contract)

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
json_type_enum = (
    schema["properties"]["envelope"]["properties"]["fields"]["items"]["properties"]["json_type"]["enum"]
)
if "object" not in json_type_enum:
    json_type_enum.append("object")
canonical_schema = schema["properties"]["canonical_json"]
if "integers" not in canonical_schema["required"]:
    canonical_schema["required"].append("integers")
canonical_schema["properties"]["integers"] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["representation", "syntax", "safe_min", "safe_max", "exponent", "negative_zero"],
    "properties": {
        "representation": {"type": "string", "const": "JSON number"},
        "syntax": {"type": "string", "minLength": 1},
        "safe_min": {"type": "integer", "const": -9007199254740991},
        "safe_max": {"type": "integer", "const": 9007199254740991},
        "exponent": {"type": "string", "const": "forbidden"},
        "negative_zero": {"type": "string", "const": "forbidden"},
    },
}
service_schema = canonical_schema["properties"]["service_time"]
for name in ["ruleset_revision", "supported_year_range"]:
    if name not in service_schema["required"]:
        service_schema["required"].append(name)
service_schema["properties"]["ruleset_revision"] = {
    "type": "string",
    "const": "america-chicago-us-2007-2037.v1",
}
service_schema["properties"]["supported_year_range"] = {
    "type": "array",
    "items": {"type": "integer"},
    "minItems": 2,
    "maxItems": 2,
}
write_json(SCHEMA, schema)

validator = VALIDATOR.read_text(encoding="utf-8")
validator = validator.replace(
    'export const VALIDATOR_VERSION = "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V1";',
    'export const VALIDATOR_VERSION = "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V2";',
)
validator = validator.replace(
    'if (record.valid_time_end !== null) {',
    'if (Object.hasOwn(record, "valid_time_end") && record.valid_time_end !== null) {',
)
validator = validator.replace(
    '"canonicalization_version","producer_release_id","replay_compatibility",',
    '"canonicalization_version","producer_release_id","domain_payload","replay_compatibility",',
)
validator = validator.replace(
    '"conformance-fixtures.json","validate-record-envelope-canonicalization.mjs",\n'
    '    "record-type-strengthening-map.json","research-plan-audit-replan.md"',
    '"conformance-fixtures.json","validate-record-envelope-canonicalization.mjs",\n'
    '    "validate-record-envelope-adversarial-v2.mjs","record-type-strengthening-map.json",'
    '"research-plan-audit-replan.md"',
)
for snippet in [
    "CUSTODIAL_V43_RECORD_ENVELOPE_VALIDATOR_V2",
    'Object.hasOwn(record, "valid_time_end")',
    '"domain_payload","replay_compatibility"',
    '"validate-record-envelope-adversarial-v2.mjs"',
]:
    if snippet not in validator:
        raise RuntimeError(f"validator edit missing: {snippet}")
VALIDATOR.write_text(validator, encoding="utf-8")

readme = README.read_text(encoding="utf-8")
if "validate-record-envelope-adversarial-v2.mjs" not in readme:
    readme = readme.replace(
        "- `validate-record-envelope-canonicalization.mjs` — deterministic validator and result generator.\n",
        "- `validate-record-envelope-canonicalization.mjs` — deterministic schema and semantic validator.\n"
        "- `validate-record-envelope-adversarial-v2.mjs` — independent attack validator for payload "
        "ownership, exact conditions, integer/time rules, actor/auth binding, versions, lineage, "
        "and real positive variants.\n",
    )
    readme = readme.replace(
        "- `validation-result.json` — generated receipt; evidence only.\n",
        "- `validation-result.json` — generated primary receipt; evidence only.\n"
        "- `adversarial-validation-result.json` — generated independent adversarial receipt; evidence only.\n",
    )
README.write_text(readme, encoding="utf-8")

research = RESEARCH.read_text(encoding="utf-8")
marker = "## 6. Post-apply independent attack and second replan"
if marker not in research:
    research += f"""
{marker}

The first applied package passed its original validator but a fresh independent review found four
false-confidence seams: `domain_payload` was used without being an explicit envelope field; unsafe
or exponent-form integer input was not bounded; service-time replay had no fixed ruleset revision;
and only one real positive record was executed while four named variants remained metadata. The
review also found that synthetic booleans were standing in for original-actor,
original-authorization, and unknown-version attacks.

The second replan keeps the accepted contract direction and adds a separate adversarial validator
rather than weakening the green validator. It makes `domain_payload` a required reserved field,
confines extensions below it, binds safe canonical integers and an explicit America/Chicago
ruleset range, executes all five positive variants, compares original context and supported
versions directly, tests inactive conditional leakage, rejects unknown top-level fields, and
attacks multi-record lineage cycles. The package remains on HOLD; actual domain record schemas
still belong to the later independently audited schema gate.
"""
RESEARCH.write_text(research, encoding="utf-8")

subprocess.run(["node", str(V2), "--refresh-fixture"], check=True)
