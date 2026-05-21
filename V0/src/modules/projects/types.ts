/**
 * Types for MIH Projects (Spec 06 V0)
 */

export type ProjectLifecycleStage =
  | 'pre_launch'
  | 'launch'
  | 'mid_construction'
  | 'near_handover'
  | 'handover_complete';

export type MihProject = {
  id: string;
  org_id: string;
  crm_project_id: string | null;
  display_name: string;
  avg_sqft: number | null;
  price_per_sqft: number | null;          // paise
  avg_ticket_value: number | null;        // paise
  fy_booking_target_count: number | null;
  fy_booking_target_value: number | null; // paise
  marketing_spend_pct: number;            // 0.02 = 2%
  fy_marketing_budget: number | null;     // computed: target_value * spend_pct
  lifecycle_stage: ProjectLifecycleStage;
  marketing_manager_user_id: string | null;
  launch_date: string | null;
  created_at: string;
  updated_at: string;
};

export type StageTransitionEffect = {
  sourcesToEnable: Array<{ source_id: string; auto_disable_at: Date | null }>;
  sourcesToDisable: string[];
};

export type LaunchAutoEnableCategory =
  | 'tv_ads'
  | 'newspaper'
  | 'theatre'
  | 'influencer';
