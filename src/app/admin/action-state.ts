/**
 * Shared shape for what an admin action reports back.
 *
 * It lives outside `actions.ts` because a `"use server"` module may only export async
 * functions: every other export is treated as a server action and the build refuses it.
 */
export interface ActionState {
  readonly error: string | null;
  readonly notice: string | null;
  /** Echoed back so a rejected login does not also wipe the e-mail that was typed. */
  readonly email?: string;
}

export const EMPTY_STATE: ActionState = { error: null, notice: null };
