import { describe, expect, it } from 'vitest';
import { buildFieldZones, computeFieldStatistics } from '../src/domain';
import type { ElementKind, ExpoElement, FieldSize, LayoutDocument } from '../src/types';

const element = (
  id: string,
  kind: ElementKind,
  x: number,
  y: number,
  width = 4,
  height = 3,
  rotation = 0,
): ExpoElement => ({ id, kind, name: id, x, y, width, height, rotation });

const doc = (field: FieldSize, elements: ExpoElement[]): LayoutDocument => ({ version: 1, title: 'stats', field, elements });

describe('computeFieldStatistics', () => {
  it('sums element footprints and leaves the rest available', () => {
    const stats = computeFieldStatistics(doc({ width: 10, height: 10 }, [element('a', 'booth', 0, 0, 4, 3), element('b', 'stage', 6, 6, 2, 2)]));
    expect(stats.fieldArea).toBe(100);
    expect(stats.occupiedArea).toBe(16);
    expect(stats.availableArea).toBe(84);
    expect(stats.occupiedRatio).toBeCloseTo(0.16);
    expect(stats.availableRatio).toBeCloseTo(0.84);
    expect(stats.elementCount).toBe(2);
    expect(stats.kinds.find((item) => item.kind === 'booth')?.area).toBe(12);
    expect(stats.kinds.find((item) => item.kind === 'stage')?.area).toBe(4);
  });

  it('uses the rotated bounding box, matching the inspection footprint', () => {
    const stats = computeFieldStatistics(doc({ width: 10, height: 10 }, [element('rot', 'booth', 8, 2, 2, 5, 90)]));
    // 旋转后包围盒为 5 x 2：场内 2 x 2 = 4，越界 3 x 2 = 6
    expect(stats.occupiedArea).toBe(4);
    expect(stats.availableArea).toBe(96);
    expect(stats.outsideArea).toBe(6);
  });

  it('keeps out-of-bounds parts out of the available area and reports fully outside elements', () => {
    const stats = computeFieldStatistics(doc({ width: 10, height: 10 }, [element('gone', 'booth', 12, 12, 4, 3)]));
    expect(stats.occupiedArea).toBe(0);
    expect(stats.availableArea).toBe(100);
    expect(stats.outsideArea).toBe(12);
    expect(stats.outsideElementCount).toBe(1);
    expect(stats.elementCount).toBe(1);
    expect(stats.kinds.find((item) => item.kind === 'booth')?.count).toBe(1);
    expect(stats.kinds.find((item) => item.kind === 'booth')?.area).toBe(0);
    expect(stats.zones.every((zone) => zone.count === 0 && zone.occupiedArea === 0)).toBe(true);
  });

  it('never produces negative area even when elements overflow on multiple sides', () => {
    const huge = element('huge', 'stage', -20, -20, 50, 50);
    const stats = computeFieldStatistics(doc({ width: 12, height: 10 }, [huge]));
    expect(stats.occupiedArea).toBe(120);
    expect(stats.availableArea).toBe(0);
    expect(stats.outsideArea).toBe(50 * 50 - 120);
    stats.zones.forEach((zone) => expect(zone.availableArea).toBe(0));
  });

  it('counts overlapping area only once', () => {
    const stats = computeFieldStatistics(doc({ width: 20, height: 20 }, [
      element('a', 'booth', 1, 1, 4, 4),
      element('b', 'booth', 3, 3, 4, 4),
    ]));
    // 4x4 + 4x4 - 重叠 2x2 = 28
    expect(stats.occupiedArea).toBe(28);
    expect(stats.availableArea).toBe(400 - 28);
    expect(stats.kinds.find((item) => item.kind === 'booth')?.area).toBe(28);
  });

  it('splits cross-zone elements geometrically so zone totals reconcile', () => {
    const field = { width: 20, height: 20 };
    const stats = computeFieldStatistics(doc(field, [element('center', 'booth', 8, 8, 4, 4)]));
    const zones = buildFieldZones(field);
    expect(zones).toHaveLength(4);
    expect(stats.zones.map((zone) => zone.name)).toEqual(['左上区', '右上区', '左下区', '右下区']);
    stats.zones.forEach((zone) => {
      expect(zone.area).toBe(100);
      expect(zone.occupiedArea).toBe(4);
      expect(zone.availableArea).toBe(96);
      expect(zone.count).toBe(1);
    });
    expect(stats.zones.reduce((sum, zone) => sum + zone.occupiedArea, 0)).toBe(stats.occupiedArea);
  });

  it('reports a fully available field when there are no elements', () => {
    const stats = computeFieldStatistics(doc({ width: 28, height: 18 }, []));
    expect(stats.elementCount).toBe(0);
    expect(stats.occupiedArea).toBe(0);
    expect(stats.availableArea).toBe(504);
    expect(stats.occupiedRatio).toBe(0);
    expect(stats.availableRatio).toBe(1);
    expect(stats.kinds.every((item) => item.count === 0 && item.area === 0)).toBe(true);
    stats.zones.forEach((zone) => {
      expect(zone.count).toBe(0);
      expect(zone.occupiedArea).toBe(0);
      expect(zone.availableArea).toBe(zone.area);
    });
  });

  it('recomputes against the new field size after resize', () => {
    const small = computeFieldStatistics(doc({ width: 12, height: 10 }, [element('a', 'booth', 1, 1)]));
    const enlarged = computeFieldStatistics(doc({ width: 20, height: 20 }, [element('a', 'booth', 1, 1)]));
    expect(small.occupiedArea).toBe(enlarged.occupiedArea);
    expect(small.occupiedArea).toBe(12);
    expect(small.availableArea).toBe(108);
    expect(enlarged.availableArea).toBe(388);
    expect(small.occupiedRatio).not.toBeCloseTo(enlarged.occupiedRatio);
  });
});
