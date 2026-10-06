import React from 'react';
import { Nav2665MReplicaContainer } from './replica/Nav2665MReplicaContainer';
import { MLine, VatFrequency } from '../types';

export interface VatNav65MReplicaProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: VatFrequency | string;
  mLines: MLine[];
  onRecalculate?: () => Promise<void> | void;
  isRecalculating?: boolean;
  initialPartnerId?: string;
  className?: string;
}

/**
 * Authentic NAV 2665M official tax return subform digital replica facade.
 * Conforms to the official Hungarian NAV ÁNYK 2665M paper/digital layout (Főlap, 02, 02-K).
 */
export function VatNav65MReplica(props: VatNav65MReplicaProps) {
  return <Nav2665MReplicaContainer {...props} />;
}
