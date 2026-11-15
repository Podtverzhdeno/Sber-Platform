# Design — measured iOS 16 source controls

| Component/variant | Figma source | Extracted geometry | Color/text |
|---|---|---|---|
| Filled button / light | `839:9700` | 50px high, 14px radius, 14px vertical / 20px horizontal padding, 10px icon/text gap | #007AFF background, white label; 17px/22px 600, letter spacing -0.408px |
| Tinted button / light | `839:9707` | same control geometry | rgba(0,122,255,.15), #007AFF text |
| Filled button / dark | `839:9728` | same control geometry | #0A84FF background, white label |
| TextField / light default | `211:5737` | 390×44px, 16px leading inset, 11px vertical text inset, 0.5px lower separator | white background, gray placeholder; 17px/22px, letter spacing -0.408px |
| TextField / light active | `211:5752` | 390×46px canvas variant with cursor; input row content stays 44px | same text, focused input native caret |

Figma source generated static frames; implementations are real `button`/`input` controls. For text field focus: visible keyboard focus outline added for accessibility; this is a documented web-only deviation from the static canvas. Static SF Symbol/clear-button artwork remains unimplemented rather than substituted with mismatched icons.

The existing `frontend/src/styles.scss` is enormous and contains legacy component overrides. Avoid uncontrolled global replacements. Build individual measured family components, compare screenshots, then replace call sites in bounded batches. Respect existing API, URLs, permissions and keyboard behavior.

## Remaining families
Button Gray/Plain/dark Tinted; TextField Typed/Typing/dark; SegmentedPicker; Toggle; SearchField; Navigation; TableView/DetailedTableView; Alert/ActionSheet/Modal; DatePicker/TimePicker/ColorPicker; TabBar; visual typography/color token extraction; icon and asset parity; all six role screens. These require further Figma data once rate limits permit it.
