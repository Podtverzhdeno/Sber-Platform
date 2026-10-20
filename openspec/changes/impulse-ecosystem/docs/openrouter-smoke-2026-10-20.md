# OpenRouter manual smoke — 2026-10-20

## Scope and safety boundary

- Provider access: OpenRouter through the existing OpenCode credential store.
- Credential handling: the API key was neither read nor printed; no credential value is stored in the repository.
- Fixtures: synthetic/public prompts only, executed from an empty temporary directory with external plugins disabled.
- Evidence policy: this report stores normalized outcomes and exit codes, not prompts, model responses, session identifiers, or raw provider traces.

## Observed model

- Requested and reported model: `cohere/north-mini-code:free`.
- OpenCode provider/model identifier: `openrouter/cohere/north-mini-code:free`.
- Discovery: `opencode models openrouter` returned the explicit `:free` model and the `openrouter/free` router; the smoke used the explicit model so the observed model is reproducible.
- Observation date: 2026-10-20. Free availability is provider-controlled and must be checked again before a release or demo.

## Results

| Check | Expected | Normalized observation | Exit code |
|---|---|---|---:|
| Provider/model discovery | OpenRouter catalog is reachable and exposes a free model | explicit free model was present | 0 |
| Structured instruction following | one compact object with four exact fields and deterministic values | valid object; all requested fields and values matched | 0 |
| Russian text and uncertainty | one Russian sentence that preserves an unknown deadline instead of inventing a date | required uncertainty marker and explanation matched; no date was invented | 0 |

Observed capabilities in this narrow smoke: text generation, Russian-language instruction following, compact structured JSON output, and preservation of an explicitly unknown fact. Tool calling, vision, long context, streaming, production latency, sustained rate limits, and schema-constrained API mode were not tested and MUST NOT be inferred from this run.

## Operational conclusion

The real OpenRouter path was reachable through OpenCode and the explicit free model completed both synthetic/public checks successfully. This is evidence for a manual development smoke only. It is not an uptime, quota, privacy, latency, or production-readiness guarantee; product runtime keeps its deterministic fallback and must re-check the current free model before use.
