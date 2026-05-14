import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-blue-600 text-white hover:bg-blue-600/80',
        secondary:
          'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80',
        outline:
          'border-slate-200 text-slate-700 bg-transparent',
        destructive:
          'border-transparent bg-red-500 text-white hover:bg-red-500/80',
        success:
          'border-transparent bg-emerald-100 text-emerald-800',
        warning:
          'border-transparent bg-amber-100 text-amber-800',
        info:
          'border-transparent bg-blue-100 text-blue-800',
        ghost:
          'border-transparent bg-slate-100 text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
