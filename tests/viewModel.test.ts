import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => initial ?? createStarterDocument()),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => createStarterDocument()), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });

  it('recomputes statistics immediately when an element is added, rotated and removed', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const occupiedBefore = vm.state.statistics.occupiedArea;
    vm.addElement('booth');
    expect(vm.state.statistics.occupiedArea).toBeGreaterThan(occupiedBefore);
    const afterAdd = vm.state.statistics.occupiedArea;
    // 入口远离其他元素：旋转 90° 只交换宽高，包围盒面积必须与检查口径一致
    vm.selectElement('entry-1');
    vm.rotateSelected();
    expect(vm.state.statistics.occupiedArea).toBe(afterAdd);
    vm.selectElement(vm.state.document.elements[vm.state.document.elements.length - 1].id);
    vm.removeSelected();
    expect(vm.state.statistics.elementCount).toBe(vm.state.document.elements.length);
    expect(vm.state.statistics.occupiedArea).toBe(occupiedBefore);
  });

  it('drops stale figures after deleting elements or resizing the field', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.removeSelected();
    const stats = vm.state.statistics;
    expect(stats.occupiedArea + stats.availableArea).toBe(stats.fieldArea);
    expect(vm.state.document.elements.some((element) => element.id === 'stage-1')).toBe(false);
    vm.resizeField(40, 30);
    expect(vm.state.statistics.fieldArea).toBe(1200);
    expect(vm.state.statistics.zones.every((zone) => zone.area === 300)).toBe(true);
    expect(vm.state.statistics.occupiedArea + vm.state.statistics.availableArea).toBe(1200);
  });

  it('shows no negative area when every element is dragged outside the field', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.state.document.elements.forEach((element) => vm.moveElement(element.id, 200, 200));
    const stats = vm.state.statistics;
    expect(stats.occupiedArea).toBe(0);
    expect(stats.availableArea).toBe(stats.fieldArea);
    expect(stats.outsideElementCount).toBe(stats.elementCount);
    stats.kinds.forEach((kind) => expect(kind.area).toBeGreaterThanOrEqual(0));
    stats.zones.forEach((zone) => {
      expect(zone.availableArea).toBe(zone.area);
      expect(zone.occupiedArea).toBe(0);
    });
  });
});
