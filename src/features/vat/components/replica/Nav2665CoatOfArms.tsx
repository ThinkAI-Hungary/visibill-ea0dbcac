import React from 'react';
import { cn } from '@/lib/utils';

interface Nav2665CoatOfArmsProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Authentic Coat of Arms of Hungary (Magyarország Hivatalos Címere)
 * in official black and white heraldic monochrome line art
 * for the NAV ÁNYK tax return forms.
 */
export function Nav2665CoatOfArms({ className, width = 36, height = 48 }: Nav2665CoatOfArmsProps) {
  return (
    <img
      src="/magyarorszag_cimere_bw.svg"
      alt="Magyarország címere"
      width={width}
      height={height}
      className={cn('object-contain select-none', className)}
      loading="eager"
    />
  );
}
