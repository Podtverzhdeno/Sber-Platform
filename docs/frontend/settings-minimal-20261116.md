# Impulse · Дополнительно → Настройки: reference-led QA

**References:** Apple [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials). Project source: `Apple UI kit/06-cases/11-identity-and-settings/README.md`.

## Decisions
- Keep all 8 existing settings tabs and server-authorized "Дополнительно" navigation. Do not invent a new settings API or working photo upload.
- Use grouped, opaque semantic surfaces inside content panels in all modes; no decorative dark gradients in light appearance. Navigation remains lighter than content.
- One clear main action ("Сохранить изменения"), neutral secondary buttons, legible labels and 44px minimum inputs/navigation targets.
- Visually hide redundant Unicode nav symbols; retain full accessible tab names and all original settings.
- Preserve profile, consent and HR preview flows. Improve visible keyboard focus on controls and hidden checkboxes.

## Acceptance
Chromium: light/blue/midnight × 320/390/1440; computed surface background for profile forms, tabs, notification lists, consent rows, HR preview, AI-Buddy danger row; document overflow, navigation, tabs and unsaved form state. Tests use synthetic API fixtures; production authorization and real API mutation E2E remain separate.
