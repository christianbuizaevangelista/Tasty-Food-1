import { DistributionType } from '../types';

// User-facing labels for distribution type. The DB/enum keeps TRADE / DROP_SHIP;
// the business prefers "Regular" and "Dropship" on screen.
export const DIST_LABEL: Record<DistributionType, string> = {
  TRADE: 'Regular',
  DROP_SHIP: 'Dropship',
};

export const distLabel = (t: string): string => DIST_LABEL[t as DistributionType] ?? t;
