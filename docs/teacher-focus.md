# Teacher-directed focus

In the teacher dashboard, select a class under **ניהול כיתה**. Under **מיקוד בשאלה ובתשובה**, choose **מיקוד ל־5 דקות** beside a student. Use **סיום המיקוד** to stop early.

The student's Machberet page dims its background while keeping the question, answer, help and navigation readable. Typed answers and personal accessibility preferences are preserved. The student can choose **סיום המיקוד** at any time. A session expires automatically, including when the open browser loses connectivity. A dismissed request is remembered on that browser across reloads and its dismissal retries when connectivity returns. The last 20 dismissed request IDs are stored per student; no answer or attention data is stored there.

The classroom status distinguishes a pending request, a request received by the browser, and a finished session. Receipt is not evidence of attention or of the student's physical presence. Updates normally arrive within five seconds while the page is visible; hidden or disconnected pages can receive them later. Connection failures mark teacher status as potentially stale. A student who is offline can dismiss immediately, but the teacher sees the dismissal after reconnection.

This feature works inside Machberet only. It does not dim other programs, lock a device, monitor gaze or detect distraction. It needs no eye-tracking hardware. Actual OptiKey/Tobii hardware testing remains outstanding. Forced-colors mode uses a strong question boundary instead of a dimming mask; printed work omits the focus controls and mask.

Implementation: additive migration `0007_student_focus.sql`, teacher-owned student/classroom routes, student-scoped receipt/dismissal, unique request IDs to ignore stale updates. Sessions are separate from assignments and preferences and cascade on account deletion. The UI uses five minutes; the API bounds requested duration to one–ten minutes.
