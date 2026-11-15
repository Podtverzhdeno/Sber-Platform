# Validate current Impulse files against source-map provenance

The [source crosswalk](IMPULSE_SOURCE_CROSSWALK.json) identifies actual Impulse files and unit-test paths verified against GitHub main on 15 November 2026, with recorded **Git blob SHA-1** values.

Run from a checkout of the Impulse repository (Python 3.9+):

    python "Apple UI kit/scripts/verify_impulse_crosswalk.py"
    python -m unittest discover -s "Apple UI kit/scripts" -p "test_verify_impulse_crosswalk.py" -v

To fail on any byte-level difference from the recorded main snapshot:

    python "Apple UI kit/scripts/verify_impulse_crosswalk.py" --strict-sha

Default mode fails when a source/test path is missing and reports changed SHA as a **warning**—because parallel Impulse development naturally changes the code. A SHA mismatch means re-inspect the current implementation, **not** overwrite it with historical content.

The checker also verifies record IDs are unique, keeps file paths inside the repository and rejects claims that any Apple design frame was measured or visually validated.

This is an offline source-provenance aid, **not** a guarantee that code matches Apple's UI kit, that Apple assets can be redistributed, or that current routes/business behavior were tested. The new Python script and synthetic tests must be executed from a checkout before being labelled passed.
