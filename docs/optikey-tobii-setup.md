# Planned OptiKey / Tobii Eye Tracker 5 setup

Research date: 2026-10-31. The user identifies OptiKey and the Tobii Eye Tracker 5 as the intended setup, and confirms that neither the hardware nor installed software is available yet. No physical-device compatibility or participant result is claimed.

## Compatibility before purchase

- This is a **Windows PC** input path. The separate Android browser/touch path remains supported; do not plan to attach this tracker to Android for OptiKey use. [OptiKey requirements](https://optikey.org/help/how-do-i-use-optikey), [Tobii specifications](https://gaming.tobii.com/product/eye-tracker-5/).
- OptiKey's current version guidance explicitly lists Eye Tracker 5 among the devices whose direct support was dropped in **v4**. It directs users needing that compatibility to **OptiKey Classic v3**. For both mouse and keyboard output, investigate the Pro Classic option linked from the official version page. Do not assume the newest OptiKey installer supports this tracker. [Official version guide](https://github.com/OptiKey/OptiKey/wiki/Optikey-versions).
- Tobii explicitly says Eye Tracker 5 does **not** support Microsoft Windows Eye Control. That feature is different from OptiKey. [Tobii FAQ](https://gaming.tobii.com/product/eye-tracker-5/).
- A proposed Eye Tracker 5 plugin for OptiKey 4.x was described as not ready for end-user installation or hardware use in its announcement. Do not use an unverified future plugin as the pilot compatibility assumption. [Project issue](https://github.com/OptiKey/OptiKey/issues/955).
- OptiKey recommends borrowing or trialing a complete setup before purchasing. Confirm the exact Windows, Tobii driver and OptiKey version combination with a hands-on trial. Naming the devices is not evidence of calibration, reliable clicking or Hebrew output. [OptiKey getting started](https://optikey.org/help/how-do-i-use-optikey).

## Input path

Tobii → compatible OptiKey setup → ordinary Windows mouse clicks and keyboard input → browser → Machberet.

Machberet does not read raw gaze data and does not need a Tobii browser SDK. OptiKey handles pointing, fixation/dwell and key selection. OptiKey's keyboard documentation says to focus the target application/input before typing; Conversation mode does not send keystrokes to other applications. [Keyboard output](https://github.com/OptiKey/OptiKey/wiki/Simulate-a-keyboard).

## Machberet settings for the proposed setup

1. On the Windows computer, first establish reliable gaze calibration and mouse/keyboard output in another simple application using the tracker and OptiKey's own instructions. Record the software versions.
2. Open the student's Machberet link in the browser.
3. In **התאמות אישיות**, select **מצביע עיניים חיצוני** for **דרך ההפעלה**. This provides the large controls; it does not start eye tracking.
4. Set **הפעלה בשהייה** to **המכשיר מפעיל בשהייה** when OptiKey supplies the clicks. Here “device” includes external assistive software. Configure the fixation duration in OptiKey. Keep Machberet's own dwell off, so it does not add another activation timer.
5. Save the accessibility settings. Choose the student's preferred palette through **צבעי המסך**.
6. Click the answer field through OptiKey, then type through OptiKey. The in-app keyboard may be closed to leave more room for the external keyboard. Scroll as needed; do not assume a docked keyboard leaves the full monitor available to the browser.
7. Pause/resume gaze operation through OptiKey. Machberet's app-dwell pause control cannot pause an external program.

Use the app's dwell mode only for an alternative setup that supplies continuous pointer movement but no clicks, with external dwell clicking disabled. Do not enable both dwell engines.

## Required actual-device acceptance

Record Windows/browser, OptiKey edition/version, Tobii driver version, display/scaling, external keyboard size/position, calibration result and student-selected theme. Use synthetic work for initial setup, then the consented participant workflow.

- Look at Start without choosing a click: no unintended navigation. Choose a click: exactly one activation.
- Enter `0.5`, `-1/2`, `x = 7`, Hebrew with spaces and Nikud. Correct using selection/Backspace. Confirm Hebrew output is available in the selected OptiKey/Windows configuration rather than assuming it from the web app.
- Type while the external keyboard is visible; ensure focus stays in the answer field and scrolling reaches all actions.
- Click an in-app key once and hold gaze afterward: exactly one character. Test OptiKey pause/resume and app/device dwell exclusivity.
- Save, reload, resume, correct, submit, receive teacher voice feedback and open/acknowledge the parent link. Reconcile recorded answers with the teacher view.
- Assess tracking accuracy, fatigue, comfort, accidental activation and needed interface assistance with the teacher/therapist; these cannot be inferred from DOM tests.

## Automated evidence boundary

`tests/e2e/external-gaze.spec.ts` models browser mouse and keyboard events with `mode=gaze` and `dwellSource=device`, including hover beyond the app's maximum dwell time, single clicks, Unicode input, keyboard correction, autosave/resume and a reduced browser work area. This verifies the application's event handling only. It does **not** execute OptiKey, Windows input injection, Tobii calibration or real gaze. `tests/live/external-gaze.spec.ts` runs the same contract against the deployed service and deletes only its synthetic teacher account.

Verification on 2026-10-31: both local scenarios passed (31.3s), and both live scenarios passed (25.4s) against Worker `f71539cc-eb0d-4266-8d45-efe24ec501e5`. Live synthetic accounts were deleted. No application/runtime change or redeployment was required.