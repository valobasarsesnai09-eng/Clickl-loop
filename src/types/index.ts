import type { z } from 'zod';
import type { addEditLinkSchema } from '@/lib/schemas';

export type LinkItem = z.infer<typeof addEditLinkSchema> & {
  id: string;
  enabled: boolean;
};

export enum CycleMode {
  SEQUENTIAL = 'SEQUENTIAL',
  RANDOM = 'RANDOM',
  SINGLE = 'SINGLE',
}

export type AppSettings = {
  mode: CycleMode;
  globalInterval: number; // in seconds, 0 means use per-link interval
  maxTotalIterations: number; // Safety limit
  userAgent: string; // Advanced setting
};

export type LogEntry = {
    timestamp: number;
    eventType: 'LOAD' | 'STOP' | 'PAUSE' | 'RESUME' | 'START' | 'FINISH' | 'INFO' | 'ERROR';
    message: string;
};
