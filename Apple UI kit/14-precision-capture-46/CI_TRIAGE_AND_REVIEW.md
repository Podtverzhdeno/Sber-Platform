# Apple UI kit — CI failure triage and owned fixes

## Evidence scope

This report is based on the **actual GitHub Actions run** [CI #43736535478](https://github.com/Podtverzhdeno/Sber-Platform/actions/runs/43736535478), generated for PR #190 HEAD `3344266e1e345c7e349bd6f51ea7850caf8cc647`. The run completed with **failure**. It predates the following remediation commits; therefore its result must **not** be presented as the status of a newer HEAD.

The reference PR is a stacked, documentation-only change; it does not edit `frontend/**`, `backend/**`, the application router, API or CSS.

## 1. Backend format job — confirmed cause

Job `backend-format-lint-types` failed at **Check formatting**, which prevented its later Ruff lint and Pyright steps. The runner printed **13 files would be reformatted, 702 already formatted**.

Three files belong to our task claim and have been corrected using the **specific Ruff formatter changes shown in the job log**:

| File | Owned remediation commit |
|---|---|
| `14-precision-capture-46/qa_browser.py` | `e1758a84dcec7a55be9785b88ee616d9b7bb3430` |
| `14-precision-capture-46/qa_pixel_compare.py` | `bb2a0d3a77294ddb6af18859f27bc48a8bacae07` |
| `14-precision-capture-46/verify.py` | `79a2f77aa6f389ca68797e2450f94f39313fcb6e` |

A separate follow-up also removed an unused `urlparse` import from `qa_browser.py` (`2e016a251274deac2923b85c063bc5f3ff68f110`) to avoid a subsequent Ruff F401 failure.

The **other ten files** in that historical formatter failure are in the parent reference PR's `Apple UI kit/scripts/` scope: `audit_reference_links.py`, `audit_source_bundle.py`, `browser_reference_qa.py`, `compare_reference_pixels.py`, `test_audit_reference_links.py`, `test_audit_source_bundle.py`, `test_compare_reference_pixels.py`, `test_verify_impulse_crosswalk.py`, `verify_impulse_crosswalk.py`, `verify_reference_pack.py`.

These ten paths were **not modified** in this child PR. The parent is active and may have updated them since the historical run. Check the parent's **current HEAD and fresh CI**, not this old failure, before deciding whether any follow-up is necessary.

## 2. Other CI results and unknowns

The same run reported success for `docker-smoke`, `backend-unit-api-integration`, `frontend-quality-and-contracts`, `secret-and-dependency-scans`, and `openspec-strict-and-docs`.

Some `frontend-build-and-e2e` shards failed in browser tests, with assertions involving app navigation, menu visibility, theme foreground or feature rendering. Because this PR's diff contains **no frontend runtime changes**, those failures have not been attributed to our reference files; tracing them belongs to active UI integration owners, not this documentation-only task.

**Do not claim green CI for our new HEAD** until its separate workflow run has concluded successfully, including the format/lint jobs and the relevant E2E shards.

## 3. Repeatable exact-branch QA commands

After checking out the **specific** PR #190 head, compare with the latest parent branch and run:

```sh
python "Apple UI kit/14-precision-capture-46/verify.py"
node "Apple UI kit/14-precision-capture-46/test_pixel_compare.cjs"
python "Apple UI kit/14-precision-capture-46/qa_browser.py"
python "Apple UI kit/14-precision-capture-46/qa_pixel_compare.py"
```

The last two require Playwright and Chromium. Also execute the project's existing Ruff formatting/lint commands as configured in CI, not independent guessed settings. Do not commit generated `qa-output/` screenshots.

The current author session performed a GitHub source readback and exact-JS RGBA math checks; **it has not run the checked-out Python/Playwright suite**. Official Apple Figma/Sketch geometry and pixel parity remain unverified.

## 4. Release gate

1. Sync child PR #190 with the actively evolving parent PR #181 under the coordinator's merge rules.
2. Obtain independent review of provenance, permissions, browser interactions and source screenshot/legal constraints.
3. Confirm all CI checks at the exact merged candidate SHA; no parent or sibling agent file overwrites.
4. Only then consider integration or a separate, authorized production UI claim. No direct main merge or deploy by this reference task.
