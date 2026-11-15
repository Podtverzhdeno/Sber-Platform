# Browser acceptance for the independent reference lab

Run from a checked-out repository. This does **not** test the actual Impulse app or Apple native UI:

    python -m pip install playwright
    python -m playwright install chromium
    python "Apple UI kit/scripts/browser_reference_qa.py"

Optional screenshots are original renderings of the authored HTML/CSS/JS (not Apple assets):

    python "Apple UI kit/scripts/browser_reference_qa.py" --screenshots-dir reference-browser-output

Coverage includes 3 initial synthetic rows, drawer focus/Escape, profile popover, tabs and search, error/empty states, regular/clear glass toggles, theme switch, form validation, dialog Escape, no horizontal overflow at 320/390/1024/1422/1440 and touch drawer with reduced motion.

This is a **test script to run**, not a statement of successful execution. The script has not been executed against the checked-out repo in this session. To approve 1:1 Apple-inspired designs, open licensed Apple 27 Figma/Sketch frames, capture the correct reference variant and compare against approved Impulse renders with proper QA, provenance and reviewer sign-off.

Browser screenshots/test outputs should not be committed as licensed Apple exports. Check permission of any external image before adding it to version control.
