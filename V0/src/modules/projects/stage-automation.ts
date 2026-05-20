/**
 * MIH Project Stage Automation — Pure Functions (Spec 06 V0)
 *
 * Computes which sources to enable or disable when a project transitions
 * between lifecycle stages. All logic is pure — no DB access.
 * Actual DB writes happen in the caller.
 */
import type {
  ProjectLifecycleStage,
  StageTransitionEffect,
  LaunchAutoEnableCategory,
} from './types.js';

/**
 * Source categories that are automatically enabled on the pre_launch → launch transition.
 * The caller is responsible for resolving category names to actual source IDs.
 */
const LAUNCH_AUTO_ENABLE_CATEGORIES: LaunchAutoEnableCategory[] = [
  'tv_ads',
  'newspaper',
  'theatre',
  'influencer',
];

/**
 * Given a project stage transition, return what sources to enable/disable.
 *
 * @param fromStage              Previous lifecycle stage (null if this is initial assignment)
 * @param toStage                New lifecycle stage
 * @param launchDate             Project launch date — used to compute auto_disable_at
 * @param launchAutoDisableDays  Days after launchDate to auto-disable (default 60)
 * @returns StageTransitionEffect with sourcesToEnable and sourcesToDisable arrays
 */
export function computeStageTransitionEffects(
  fromStage: ProjectLifecycleStage | null,
  toStage: ProjectLifecycleStage,
  launchDate: Date | null,
  launchAutoDisableDays: number = 60,
): StageTransitionEffect {
  // pre_launch → launch: enable launch-phase source categories
  if (fromStage === 'pre_launch' && toStage === 'launch') {
    const autoDisableAt: Date | null = launchDate
      ? new Date(launchDate.getTime() + launchAutoDisableDays * 24 * 60 * 60 * 1000)
      : null;

    const sourcesToEnable = LAUNCH_AUTO_ENABLE_CATEGORIES.map((category) => ({
      source_id: category,
      auto_disable_at: autoDisableAt,
    }));

    return { sourcesToEnable, sourcesToDisable: [] };
  }

  // All other transitions: no automatic changes in V0
  return { sourcesToEnable: [], sourcesToDisable: [] };
}

/**
 * Whether a source allowlist entry should be auto-disabled given the current time.
 *
 * @param autoDisableAt  Scheduled disable date, or null if no auto-disable
 * @param now            Current time
 * @returns true if the source should be disabled
 */
export function shouldAutoDisable(
  autoDisableAt: Date | null,
  now: Date,
): boolean {
  if (autoDisableAt === null) return false;
  return now >= autoDisableAt;
}
