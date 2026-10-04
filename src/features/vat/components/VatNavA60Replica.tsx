import React from 'react';
import {
  Nav26A60ReplicaContainer,
  type A60SheetType,
  type Nav26A60ReplicaContainerProps,
} from './replica/Nav26A60ReplicaContainer';

export interface VatNavA60ReplicaProps extends Nav26A60ReplicaContainerProps {}

/**
 * Authentic NAV 26A60 official EU community declaration digital replica facade.
 * Conforms to the official Hungarian NAV ÁNYK 26A60 layout.
 */
export function VatNavA60Replica(props: VatNavA60ReplicaProps) {
  return <Nav26A60ReplicaContainer {...props} />;
}

export type { A60SheetType };
