/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { performance } from 'node:perf_hooks';
import { debugLogger } from '../logger/debugLogger.js';

interface StartupPhase {
  name: string;
  startCpuUsage: NodeJS.CpuUsage;
  cpuUsage?: NodeJS.CpuUsage;
  details?: Record<string, string | number | boolean>;
  ended: boolean;
}

interface StartupPhaseHandle {
  end(details?: Record<string, string | number | boolean>): void;
}

class StartupProfiler {
  private readonly phases = new Map<string, StartupPhase>();
  private static instance: StartupProfiler;

  private constructor() {}

  static getInstance(): StartupProfiler {
    StartupProfiler.instance ??= new StartupProfiler();
    return StartupProfiler.instance;
  }

  start(
    phaseName: string,
    details?: Record<string, string | number | boolean>,
  ): StartupPhaseHandle | undefined {
    const existing = this.phases.get(phaseName);
    if (existing && !existing.ended) {
      debugLogger.warn(`[STARTUP] Phase '${phaseName}' is already active.`);
      return undefined;
    }

    performance.mark(this.startMark(phaseName), { detail: details });
    const phase: StartupPhase = {
      name: phaseName,
      startCpuUsage: process.cpuUsage(),
      details,
      ended: false,
    };
    this.phases.set(phaseName, phase);
    return { end: (endDetails) => this.end(phase, endDetails) };
  }

  flush(): void {
    for (const phase of this.phases.values()) {
      if (!phase.ended) {
        debugLogger.warn(`[STARTUP] Phase '${phase.name}' was never ended.`);
      } else {
        const measure = performance
          .getEntriesByName(phase.name, 'measure')
          .at(-1);
        if (measure && phase.cpuUsage) {
          debugLogger.debug('[STARTUP]', phase.name, {
            durationMs: measure.duration,
            cpuUser: phase.cpuUsage.user,
            cpuSystem: phase.cpuUsage.system,
            ...phase.details,
          });
        }
      }
      performance.clearMarks(this.startMark(phase.name));
      performance.clearMarks(this.endMark(phase.name));
      performance.clearMeasures(phase.name);
    }
    this.phases.clear();
  }

  private end(
    phase: StartupPhase,
    details?: Record<string, string | number | boolean>,
  ): void {
    if (phase.ended) {
      debugLogger.warn(`[STARTUP] Phase '${phase.name}' was already ended.`);
      return;
    }
    if (performance.getEntriesByName(this.startMark(phase.name)).length === 0) {
      phase.ended = true;
      debugLogger.warn(`[STARTUP] Start mark for '${phase.name}' is missing.`);
      return;
    }
    performance.mark(this.endMark(phase.name), { detail: details });
    performance.measure(
      phase.name,
      this.startMark(phase.name),
      this.endMark(phase.name),
    );
    phase.cpuUsage = process.cpuUsage(phase.startCpuUsage);
    phase.details = { ...phase.details, ...details };
    phase.ended = true;
  }

  private startMark(phaseName: string): string {
    return `startup:${phaseName}:start`;
  }

  private endMark(phaseName: string): string {
    return `startup:${phaseName}:end`;
  }
}

export const startupProfiler = StartupProfiler.getInstance();
