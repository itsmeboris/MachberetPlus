# Accessible visual design review and adjustment

User requests a deep review and implementation across the Android web pilot; prior waiver of design questions applies. WCAG 2.2 AA is the baseline, with stronger text contrast where practical, not a claim of complete compliance.

Scope: authentication, teacher/classrooms/capture, student workbook and access settings, teacher review and parent work. Review actual rendered pages and controls, not just palette swatches.

- Establish shared high-contrast text/surface/border/action tokens. Use readable secondary text, visible field boundaries, explicit selected and disabled states, dual-color keyboard focus, meaningful danger treatment and error/success text.
- Reduce visual clutter and large empty spacing, preserve RTL and legible Hebrew without tight letter spacing. Use scalable text and 320px reflow, 48px compact keyboard targets and deliberately large accessible targets. Respect reduced motion and forced colors.
- Remove the dark full-screen spotlight overlay; emphasize the active question without hiding navigation or help. Improve settings disclosure, question navigation focus and keyboard controls.
- Add skip navigation, meaningful headings, accessible names/status announcements and safe form semantics. Keep current functionality and student work intact.
- Test rendered contrast with axe, keyboard focus, narrow/large-text layouts and all primary roles. Inspect synthetic screenshots, run existing workflow checks, review changes, deploy and smoke-test live. Record limitations requiring actual TalkBack, gaze/switch and Android participant testing.
