export type PeriodVariance = {
  period_id: string;
  period_type: string;
  period_label: string;
  start_date: string;
  end_date: string;
  planned_paise: number;
  actual_paise: number;
  variance_paise: number;          // actual - planned (negative = underspend)
  variance_pct: number | null;     // null when planned = 0
  is_over_budget: boolean;
};

export type VarianceInput = {
  period_id: string;
  period_type: string;
  period_label: string;
  start_date: string;
  end_date: string;
  planned_paise: number;
  actual_paise: number;
};

export function computeVariance(periods: VarianceInput[]): PeriodVariance[] {
  return periods.map((p) => {
    const variance_paise = p.actual_paise - p.planned_paise;
    const variance_pct =
      p.planned_paise === 0 ? null : (variance_paise / p.planned_paise) * 100;
    return {
      period_id: p.period_id,
      period_type: p.period_type,
      period_label: p.period_label,
      start_date: p.start_date,
      end_date: p.end_date,
      planned_paise: p.planned_paise,
      actual_paise: p.actual_paise,
      variance_paise,
      variance_pct: variance_pct !== null ? Math.round(variance_pct * 100) / 100 : null,
      is_over_budget: variance_paise > 0,
    };
  });
}

export type ReallocationValidation = {
  valid: boolean;
  error?: string;
};

export function validateReallocation(
  fromPlannedPaise: number,
  amountPaise: number,
): ReallocationValidation {
  if (amountPaise <= 0) {
    return { valid: false, error: 'amount_paise must be greater than 0' };
  }
  if (amountPaise > fromPlannedPaise) {
    return {
      valid: false,
      error: `Insufficient budget: from_period has ${fromPlannedPaise} paise planned, cannot move ${amountPaise}`,
    };
  }
  return { valid: true };
}
