/** Client timing constants, kept in one place instead of scattered literals. */

/** Base delay for WebSocket reconnect backoff (doubles per attempt). */
export const RECONNECT_BASE_MS = 500;
/** Ceiling for the reconnect backoff. */
export const RECONNECT_MAX_MS = 8_000;
/** How often countdown displays re-evaluate the remaining seconds. */
export const COUNTDOWN_TICK_MS = 250;
/** How long passing notices (disconnects, reconnects) stay on screen. */
export const NOTICE_DISMISS_MS = 5_000;
/** How long the Leave button stays armed awaiting its confirming tap. */
export const LEAVE_CONFIRM_MS = 3_000;
/** How long all completed plays remain still before sweeping to the winner. */
export const TRICK_RESULT_HOLD_MS = 3_000;
/** Total lifetime of a completed trick, including its 600ms sweep animation. */
export const TRICK_SWEEP_MS = TRICK_RESULT_HOLD_MS + 600;
/** How long a trump declaration stamp stays in the moments layer. */
export const MOMENT_TRUMP_STAMP_MS = 1_400;
/** How long a friend reveal stamp stays in the moments layer. */
export const MOMENT_FRIEND_REVEAL_STAMP_MS = 1_800;
/** Leak guard for fire-and-forget game moments. */
export const MOMENT_MAX_AGE_MS = 8_000;
/** Temporary pulse duration for the seat that won the latest trick. */
export const TRICK_WINNER_GLOW_MS = 1_500;
/** How long the throw result banner stays before auto-dismissing. */
export const THROW_BANNER_MS = 8_000;
/** How long error toasts stay before auto-dismissing. */
export const TOAST_DISMISS_MS = 8_000;
