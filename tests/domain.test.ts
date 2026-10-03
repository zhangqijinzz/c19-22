import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findNarrowChannels, findOverlaps, summarizeLayout } from '../src/domain';
import type { ExpoElement } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 3 }]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });
});

describe('layout statistics', () => {
  const doc = (field: { width: number; height: number }, elements: ExpoElement[]) => ({ version: 1 as const, title: 'x', field, elements });

  it('aggregates count, area and share by element kind', () => {
    const stats = summarizeLayout(doc({ width: 20, height: 10 }, [
      item('booth-1', 0, 0, 5, 3.5),
      item('booth-2', 6, 0, 5, 3.5),
      { ...item('stage-1', 0, 5, 8, 4), kind: 'stage' },
    ]));
    const booth = stats.byKind.find((row) => row.kind === 'booth');
    const stage = stats.byKind.find((row) => row.kind === 'stage');
    expect(booth).toMatchObject({ count: 2, area: 35, share: 17.5 });
    expect(stage).toMatchObject({ count: 1, area: 32, share: 16 });
    expect(stats.occupiedArea).toBe(67);
    expect(stats.freeArea).toBe(133);
    expect(stats.usageShare).toBe(33.5);
  });

  it('measures rotated elements by their rotated footprint, clipped to the field', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    const stats = summarizeLayout(doc({ width: 10, height: 10 }, [rotated]));
    expect(stats.occupiedArea).toBe(4);
    expect(stats.freeArea).toBe(96);
  });

  it('excludes out-of-bounds parts from occupied area', () => {
    const stats = summarizeLayout(doc({ width: 10, height: 10 }, [item('edge', 8, 8, 4, 4)]));
    expect(stats.occupiedArea).toBe(4);
    expect(stats.freeArea).toBe(96);
  });

  it('never reports a negative free area when elements cover or exceed the field', () => {
    const stats = summarizeLayout(doc({ width: 10, height: 10 }, [item('a', 0, 0, 10, 10), item('b', 0, 0, 10, 10)]));
    expect(stats.occupiedArea).toBe(200);
    expect(stats.freeArea).toBe(0);
  });

  it('returns the whole field as free area for an empty layout', () => {
    const stats = summarizeLayout(doc({ width: 28, height: 18 }, []));
    expect(stats.fieldArea).toBe(504);
    expect(stats.occupiedArea).toBe(0);
    expect(stats.freeArea).toBe(504);
    expect(stats.usageShare).toBe(0);
    expect(stats.byKind.every((row) => row.count === 0 && row.area === 0)).toBe(true);
    expect(stats.byZone.every((row) => row.count === 0 && row.area === 0)).toBe(true);
  });

  it('treats fully out-of-bounds elements as zero area without going negative', () => {
    const stats = summarizeLayout(doc({ width: 10, height: 10 }, [item('far', 20, 20, 4, 3)]));
    expect(stats.occupiedArea).toBe(0);
    expect(stats.freeArea).toBe(100);
    expect(stats.byZone.find((row) => row.zone === 'se')).toMatchObject({ count: 1, area: 0 });
  });

  it('assigns elements to zones by the center of their footprint', () => {
    const stats = summarizeLayout(doc({ width: 20, height: 10 }, [
      item('nw', 1, 1, 2, 2),
      item('ne', 15, 1, 2, 2),
      item('sw', 1, 7, 2, 2),
      item('se', 15, 7, 2, 2),
    ]));
    for (const zone of ['nw', 'ne', 'sw', 'se'] as const) {
      expect(stats.byZone.find((row) => row.zone === zone)).toMatchObject({ count: 1, area: 4, share: 2 });
    }
  });
});
