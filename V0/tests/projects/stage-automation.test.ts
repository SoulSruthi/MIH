/**
 * Tests for projects stage-automation pure functions (Spec 06 V0)
 */
import { describe, it, expect } from 'vitest';
import {
  computeStageTransitionEffects,
  shouldAutoDisable,
} from '../../src/modules/projects/stage-automation.js';
import type { ProjectLifecycleStage } from '../../src/modules/projects/types.js';

// ---------------------------------------------------------------------------
// computeStageTransitionEffects
// ---------------------------------------------------------------------------

describe('computeStageTransitionEffects', () => {
  // -------------------------------------------------------------------------
  // pre_launch → launch: enables 4 categories with auto_disable_at
  // -------------------------------------------------------------------------
  describe('pre_launch → launch', () => {
    it('returns 4 source categories to enable', () => {
      const launchDate = new Date('2026-06-01T00:00:00Z');
      const effects = computeStageTransitionEffects('pre_launch', 'launch', launchDate);

      expect(effects.sourcesToEnable).toHaveLength(4);
      expect(effects.sourcesToDisable).toHaveLength(0);
    });

    it('enables the correct categories: tv_ads, newspaper, theatre, influencer', () => {
      const launchDate = new Date('2026-06-01T00:00:00Z');
      const effects = computeStageTransitionEffects('pre_launch', 'launch', launchDate);

      const ids = effects.sourcesToEnable.map((s) => s.source_id);
      expect(ids).toContain('tv_ads');
      expect(ids).toContain('newspaper');
      expect(ids).toContain('theatre');
      expect(ids).toContain('influencer');
    });

    it('sets auto_disable_at to launchDate + 60 days by default', () => {
      const launchDate = new Date('2026-06-01T00:00:00Z');
      const effects = computeStageTransitionEffects('pre_launch', 'launch', launchDate);

      const expectedDisableAt = new Date('2026-07-31T00:00:00Z'); // 60 days after June 1
      for (const source of effects.sourcesToEnable) {
        expect(source.auto_disable_at).not.toBeNull();
        expect(source.auto_disable_at!.getTime()).toBe(expectedDisableAt.getTime());
      }
    });

    it('respects a custom launchAutoDisableDays parameter', () => {
      const launchDate = new Date('2026-06-01T00:00:00Z');
      const effects = computeStageTransitionEffects('pre_launch', 'launch', launchDate, 30);

      const expectedDisableAt = new Date('2026-07-01T00:00:00Z'); // 30 days after June 1
      for (const source of effects.sourcesToEnable) {
        expect(source.auto_disable_at!.getTime()).toBe(expectedDisableAt.getTime());
      }
    });

    it('sets auto_disable_at to null when launchDate is null', () => {
      const effects = computeStageTransitionEffects('pre_launch', 'launch', null);

      expect(effects.sourcesToEnable).toHaveLength(4);
      for (const source of effects.sourcesToEnable) {
        expect(source.auto_disable_at).toBeNull();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Other transitions: no effects
  // -------------------------------------------------------------------------
  describe('other transitions produce no effects', () => {
    const noEffectCases: Array<[ProjectLifecycleStage | null, ProjectLifecycleStage]> = [
      ['launch', 'mid_construction'],
      ['mid_construction', 'near_handover'],
      ['near_handover', 'handover_complete'],
      [null, 'pre_launch'],
      [null, 'launch'],
    ];

    it.each(noEffectCases)(
      '%s → %s returns empty effects',
      (fromStage, toStage) => {
        const effects = computeStageTransitionEffects(
          fromStage,
          toStage,
          new Date('2026-06-01T00:00:00Z'),
        );

        expect(effects.sourcesToEnable).toHaveLength(0);
        expect(effects.sourcesToDisable).toHaveLength(0);
      },
    );
  });
});

// ---------------------------------------------------------------------------
// shouldAutoDisable
// ---------------------------------------------------------------------------

describe('shouldAutoDisable', () => {
  it('returns false when autoDisableAt is null', () => {
    expect(shouldAutoDisable(null, new Date('2026-06-15T00:00:00Z'))).toBe(false);
  });

  it('returns false when autoDisableAt is in the future', () => {
    const future = new Date('2026-12-31T00:00:00Z');
    const now = new Date('2026-06-15T00:00:00Z');
    expect(shouldAutoDisable(future, now)).toBe(false);
  });

  it('returns true when autoDisableAt is in the past', () => {
    const past = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-06-15T00:00:00Z');
    expect(shouldAutoDisable(past, now)).toBe(true);
  });

  it('returns true when autoDisableAt equals now (boundary: >= triggers disable)', () => {
    const exactNow = new Date('2026-06-15T12:00:00Z');
    expect(shouldAutoDisable(exactNow, exactNow)).toBe(true);
  });

  it('returns false for a date one millisecond in the future', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const justAfter = new Date(now.getTime() + 1);
    expect(shouldAutoDisable(justAfter, now)).toBe(false);
  });
});
