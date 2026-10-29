# Warning and burnout recovery

Version 1 saved `recoverable: false` in warning/burnout and omitted both phase
deadlines. Restoring it could only reject the snapshot or incorrectly clear its
lockout. Such legacy unsafe snapshots are still refused and their evidence kept.
Legacy snapshots explicitly marked recoverable retain their existing support.

Version 2 adds match-relative `warningUntilMs`, `penaltyUntilMs`, `coolingAtMs` and
`finished`. Persistence retains the same match/contest/server-start identity and
ordered accepted event log. No synthetic scoring event is added on restoration.
Elapsed phase deadlines are retained even if suspension delayed a timer callback.

Safe behavior follows validation-v3 backend replay:

| State at server elapsed time | Restoration |
| --- | --- |
| Before warning deadline | Restore the original save window, heat and score; accepted actions and one eligible antacid remain possible. |
| At warning deadline / active burnout | Reset combo once, reset heat to 68, and lock accepted input until the original warning deadline plus 1500 ms. |
| At or after burnout end | Expire the lockout, apply elapsed natural cooling, and resume eligible input without replaying scoring events. |
| Duration exhausted or snapshot finished | Remain FINISHED, with no gameplay timers or eligible input. A finished hook rejects any stale active snapshot. |
| Finalized input log / pending immutable result | Existing finalization and receipt flows remain responsible; no mutable replacement submission is created by recovery. |

There is no cooling during warning. Cooling after transition starts at the
original warning deadline, subject to the normal last-bite cooling delay. A
snapshot taken during active burnout resumes from its actual cooling observation
time rather than cooling the same interval twice. Phase advancement never grants
an input score or a perfect-cooldown bonus for the burnout transition.

Server elapsed time must be finite and no earlier than the captured elapsed time.
Malformed or conflicting phase clocks fail before mutating live state. Remaining
time is derived from the original duration and server elapsed time. A separate
terminal timeout handles fractional seconds; the display interval cannot extend
the deadline. Time spent waiting for screen hydration is included using the
already-bound match origin. Recovery cooling never advances beyond match duration.

Focused verification:

    & "C:\Program Files\nodejs\node.exe" --test frontend/tests/warning-burnout-recovery.test.js

Tests execute the real gameplay hook, persistence and action handler against
synthetic events with in-memory storage, mocked clocks/transport, and production
backend replay. They cover phase boundaries, one antacid save, score/log ordering,
fractional deadlines, finished snapshots, repeated recovery and immutable retries.
These are local source/runtime regressions, not device or live database acceptance.
