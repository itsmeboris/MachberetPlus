# Hebrew web accessibility design review

Review date: 2026-10-31. Scope: the React Hebrew RTL web interface, including use in an Android browser. This is not a native Android application review or a claim of complete WCAG conformance.

Reference: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) text contrast, non-text contrast, resize/reflow, visible focus and alternatives to dragging. The app deliberately uses larger touch targets than the AA minimum.

## Design and interaction changes

- Shared dark text, blue actions and light neutral surfaces replace faint secondary text and field boundaries. Disabled controls remain readable; selected controls use borders and programmatic state as well as color.
- Scalable Hebrew typography, wrapping toolbars and simpler panels reduce clutter. Compact number keys remain at least 48px, while motor/gaze/switch modes retain 88px keys.
- A question border replaces the dark spotlight overlay, keeping navigation and help readable. Reduced-motion and forced-color preferences are respected.
- Skip navigation, corrected heading levels, contextual button names, disclosure states and focus restoration improve keyboard and screen-reader navigation.
- Image corners can be selected by name and moved with direction buttons, without dragging. Teacher answer-marking options have clearer selected states.
- Free-form answers keep the unrestricted phone keyboard for algebra, fractions and negative values; the compact in-app keypad still provides decimal entry.

## Method and baseline

The browser suite uses `@axe-core/playwright` with WCAG A/AA rule tags through WCAG 2.2. Synthetic teacher/student data exercise authentication, registration, teacher dashboard, capture editor, student dashboard, workbook with numeric keypad, accessibility preferences, teacher review, parent review, and parent photo capture. Each scan attaches the complete axe report, including rules that require human review.

Before the design fixes, scans of the first nine states found a shared footer contrast failure: `#64748b` on `#faf8f5`, measured by axe as **4.48:1** at 14 px. The capture step label had the same **4.48:1** contrast at 16 px. Both require 4.5:1 for normal text. No other tagged axe violations were reported in those initial states; this does not establish that all controls or interaction paths are accessible.

## Verified result

After the final design and pointer-based image-corner changes, all **3 accessibility browser tests passed** within the full suite: **24 passed, 1 skipped** (the opt-in private-photo/model test). All **12 scanned states** had zero tagged axe violations, including both teacher and parent image editors with a synthetic uploaded worksheet. All **70 unit/API tests** and the production build passed. Independent review caught an overly restrictive mobile input hint for free-form math; it was corrected and covered by a browser assertion.

The expanded local suite initially exceeded the login throttle because simulated students shared an address. Each fixture now uses its own localhost-only test client header. Production rate limits are unchanged; the complete rerun passed.

Live verification exposed a transient 1.55:1 contrast failure while the new-assignment button changed from disabled to enabled. Removing its background-color transition keeps text and background states synchronized. The accessibility suite passed again locally (3 tests, 34.2 seconds), and the production build passed after that correction.

The following ratios are calculated from the final CSS colors using WCAG relative luminance; the browser scans independently verify rendered text contrast.

| Use | Foreground / background | Contrast |
| --- | --- | --- |
| Footer and capture step label | `#42566a` / `#f1f5f8` | 6.91:1 (previously 4.48:1) |
| Main text on panels | `#172b3a` / `#ffffff` | 14.55:1 |
| Primary action text | `#ffffff` / `#164f86` | 8.41:1 |
| Control boundary on white | `#687b8c` / `#ffffff` | 4.37:1 |
| Control boundary on page | `#687b8c` / `#f1f5f8` | 3.99:1 |

The earlier reduced-motion regression also failed against the previous 150 ms button transition and passes with the new motion preference styles. All tested 320 px/text-enlargement layouts passed; no claim is made that a pre-existing overflow was fixed.

## Regression coverage

Run `npx playwright test tests/e2e/design-accessibility.spec.ts --workers=1`.

- Axe scans include real rendered text contrast and accessible names/roles; no failing rules are disabled.
- Reflow checks use a 320 CSS-pixel viewport. A second check doubles the computed font size of every element, including fixed-pixel fonts, without enlarging the viewport. It checks horizontal document overflow in registration, teacher dashboard, capture, workbook, teacher review, parent capture, and parent review.
- Student controls are exercised with emulated reduced motion and forced colors. Keyboard traversal checks that focused controls have a visible outline and remain exposed at their center point, including when the browser scrolls down to the keypad.
- The selected student dashboard filter has a programmatic pressed state and a visible border in forced colors.

The text enlargement is a deterministic stress test, not an emulation of every Android browser's font scaling. Forced-colors and reduced-motion tests use Chromium media emulation, not physical Windows high contrast or Android accessibility settings.

## Remaining manual verification

Use a physical Android device with TalkBack to verify Hebrew pronunciation, RTL reading order, control announcements, touch exploration, font/display scaling, and the software keyboard. Check desktop screen readers, actual switch access and eye-gaze hardware, long real classroom names, camera permission flows, recognition results, and printing separately. Canvas handwriting and document/image content require human review; automated DOM checks cannot assess their complete equivalence or usability.

The existing end-to-end suites cover additional functional flows. Automated contrast and reflow tests support, but do not replace, an accessibility review with users.

Final live verification: **7 tests passed** on Worker `e44e821a-9238-49fc-bd1a-c598f24040eb`, covering all three accessibility scenarios, three mobile/input-mode scenarios and the scanned-worksheet/voice-feedback/parent workflow. Synthetic test accounts were deleted. No database migration was needed. Reviewed screenshots are saved in `artifacts/accessible-teacher.png`, `artifacts/accessible-workbook-keypad.png` and `artifacts/accessible-teacher-review.png`.