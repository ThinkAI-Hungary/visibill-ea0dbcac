import React from 'react';
import { Nav2665ReplicaContainer, SheetType } from './replica/Nav2665ReplicaContainer';

export interface VatNav65ReplicaProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  getVal: (row: string, col: 'base' | 'tax') => number;
  onRecalculate?: () => Promise<void> | void;
  isRecalculating?: boolean;
  mLines?: any[];
  defaultSheet?: SheetType;
}

/**
 * Authentic NAV 2665A official tax return form digital replica facade.
 * Conforms to the official Hungarian NAV ÁNYK 2665A paper/digital layout.
 */
export function VatNav65Replica(props: VatNav65ReplicaProps) {
  return <Nav2665ReplicaContainer {...props} />;
}

