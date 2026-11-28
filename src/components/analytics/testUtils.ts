// Shared fixture factory for analytics component tests. Produces a minimal but
// representative AnalyticsSnapshot; override any field via `overrides`.
import type { AnalyticsSnapshot } from '@/types/analytics';

export function makeSnapshot(overrides: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  return {
    weekStart: '2026-11-16',
    weekEnd: '2026-11-22',
    plannedMins: 600,
    actualMins: 540,
    unplannedMins: 120,
    adHocMins: 180,
    blockCount: 6,
    logCount: 8,
    capacityMins: 2400,
    capacityUtilizationPct: 22.5,
    pacingFidelityPct: 90,
    categories: [
      {
        categoryId: 'cat-1',
        name: 'Deep Work',
        colorHex: '#4f46e5',
        plannedMins: 300,
        actualMins: 240,
        varianceMins: -60,
        variancePct: -20,
        realizationPct: 80,
        tendency: 'on-track',
      },
      {
        categoryId: 'cat-2',
        name: 'Health',
        colorHex: '#059669',
        plannedMins: 120,
        actualMins: 180,
        varianceMins: 60,
        variancePct: 50,
        realizationPct: 150,
        tendency: 'over-realized',
      },
      {
        categoryId: null,
        name: 'Uncategorized',
        colorHex: '#64748b',
        plannedMins: 0,
        actualMins: 120,
        varianceMins: 120,
        variancePct: null,
        realizationPct: null,
        tendency: 'insufficient',
      },
    ],
    dailyRhythm: [
      { date: '2026-11-16', isoWeekday: 1, plannedMins: 120, actualMins: 90 },
      { date: '2026-11-17', isoWeekday: 2, plannedMins: 0, actualMins: 0 },
      { date: '2026-11-18', isoWeekday: 3, plannedMins: 180, actualMins: 150 },
      { date: '2026-11-19', isoWeekday: 4, plannedMins: 120, actualMins: 150 },
      { date: '2026-11-20', isoWeekday: 5, plannedMins: 180, actualMins: 150 },
      { date: '2026-11-21', isoWeekday: 6, plannedMins: 0, actualMins: 0 },
      { date: '2026-11-22', isoWeekday: 7, plannedMins: 0, actualMins: 0 },
    ],
    categoryStack: [
      { date: '2026-11-16', categoryId: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', minutes: 90 },
      { date: '2026-11-17', categoryId: 'cat-2', name: 'Health', colorHex: '#059669', minutes: 60 },
      { date: '2026-11-18', categoryId: null, name: 'Uncategorized', colorHex: '#64748b', minutes: 120 },
    ],
    drift: {
      sessions: 12,
      avgVarianceMins: 15,
      avgAbsVarianceMins: 45,
      grade: 'B+',
      tasks: [
        {
          taskId: 'task-1',
          title: 'Write report',
          sessions: 4,
          avgVarianceMins: -30,
          avgAbsVarianceMins: 30,
          bias: 'underestimated',
        },
      ],
      recentSessions: [
        {
          blockId: 'block-1',
          taskId: 'task-1',
          taskTitle: 'Write report',
          plannedMins: 60,
          actualMins: 90,
          varianceMins: 30,
        },
      ],
    },
    rollover: {
      rolledCount: 2,
      dismissedCount: 1,
      missedCount: 1,
      pendingCount: 3,
      rolledMins: 120,
      dismissedMins: 45,
      missedMins: 60,
      pendingMins: 180,
      events: [
        { blockId: 'rb-1', taskTitle: 'Deep dive', scheduledDate: '2026-11-19', status: 'rolled', minutes: 60 },
        { blockId: 'rb-2', taskTitle: 'Gym', scheduledDate: '2026-11-20', status: 'dismissed', minutes: 45 },
      ],
    },
    moods: [
      { mood: 'restorative', count: 2, minutes: 90 },
      { mood: 'energizing', count: 1, minutes: 60 },
    ],
    reflections: [
      {
        logId: 'log-1',
        logDate: '2026-11-18',
        title: 'Morning run',
        mood: 'energizing',
        notes: 'Felt great afterwards',
        minutes: 45,
      },
    ],
    insights: ['You logged 9h of planned intent this week.', 'Ad-hoc time made up 33% of reality.'],
    ...overrides,
  };
}
