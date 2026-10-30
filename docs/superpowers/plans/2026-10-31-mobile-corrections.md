# Phone input and correction feedback

The user's phone screenshot and feedback are the specification; further design questions were waived. Work within the deployed web app and preserve existing records.

- Replace wrapping math-key rows with a responsive numeric keypad including decimals. Separate optional symbols and label multiplication versus the variable x. Preserve deliberately enlarged controls and switch scanning.
- Explain touch/mouse/keyboard, large targets, external eye-pointer support, dwell activation and question spotlight accurately. Eye mode must not imply camera-based tracking.
- Let students explicitly withdraw a submission before saved teacher feedback, correct it and resubmit. Use both answer and content revisions to prevent stale teacher feedback being attached to changed answers. Reviewed work requires an explicit teacher return, with old parent links revoked.
- Add per-exercise teacher marking (correct, retry, unmarked) alongside optional comments, and display it consistently in student/parent records and export.
- Explain current recognition costs using official Cloudflare pricing; retain local printed OCR and explicitly opted-in cloud handwriting recognition.

Verification: API ownership and transition races; mobile decimal entry, symbol labels, keyboard/switch access and target sizes; student correction/resubmission; teacher marks and returned feedback; build, browser regression, deployment smoke. Keep private photographs and unrelated untracked references out of commits.

Completed: 39 unit/API tests, 18 local browser tests, production build and six live scenarios passed across targeted runs. Independent review found a parent-link issuance race, fixed and re-reviewed. Worker `db8b2031-3811-4768-9535-a96d64e81d25` deployed without migrations. See readiness.md for evidence and actual-device limitations.
