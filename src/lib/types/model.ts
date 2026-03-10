export interface ModelBacktest {
  calibration: CalibrationPoint[];
  rollingAccuracy: RollingAccuracyPoint[];
  quintileReturns: QuintileReturn[];
  topVsBottomSpread: SpreadPoint[];
  totalFundsScored: number;
  dataStartDate: string;
  lastUpdated: string;
  peerGroupAccuracy: PeerGroupAccuracy[];
}

export interface CalibrationPoint {
  predictedBucket: number;
  actualBeatRate: number;
  sampleSize: number;
}

export interface RollingAccuracyPoint {
  date: string;
  hitRate: number;
}

export interface QuintileReturn {
  quintile: 1 | 2 | 3 | 4 | 5;
  avgExcessReturn: number;
  fundCount: number;
}

export interface SpreadPoint {
  date: string;
  spread: number;
}

export interface PeerGroupAccuracy {
  peerGroup: string;
  accuracy: number;
  sampleSize: number;
}
