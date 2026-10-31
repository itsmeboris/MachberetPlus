# Student color themes implementation plan

Goal: implement the user's approved warm cream default, pale blue and dark slate alternatives, saved per student with a cream reset. Existing design-question waiver applies.

Architecture: add a validated theme enum to the existing preferences JSON, apply a document theme only while the student Access component is mounted, and replace fixed UI colors with semantic palette tokens. No database migration. Theme choices preview immediately and persist automatically through an actor-scoped JSON patch; reset changes only theme. No inference from diagnosis, no change to exercises or answers.

User clarification: provide an easy, clearly labeled switching menu. The student toolbar now shows the current theme and opens three large named choices with swatches, selected text/state, reset and close. Independent review found focus restoration and stale initial-load races; both corrected and regression-tested.

Execution: inline using the executing-plans workflow.

- Add regression coverage for preference defaults, round-trip persistence, invalid values and account isolation; observe failure.
- Extend types/server validation and add a labeled student theme selector/reset. Remove the document override on logout.
- Implement full cream/blue/dark semantic palettes, preserving readable states, focus, forced colors and print.
- Check all themes with rendered axe scans, reload/reset, narrow reflow and existing mobile/workflow tests. Build, review diff, deploy, run live acceptance and publish source/evidence.
