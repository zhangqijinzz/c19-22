import type {
  Analysis,
  BoundsIssue,
  ChannelIssue,
  ElementKind,
  ElementSpec,
  ExpoElement,
  FieldSize,
  FieldStatistics,
  KindStat,
  LayoutDocument,
  PathPreview,
  OverlapIssue,
  Rect,
  ZoneDefinition,
  ZoneStat,
} from './types';

export const MIN_CHANNEL = 1.2;

export const ELEMENT_SPECS: Record<ElementKind, ElementSpec> = {
  booth: { kind: 'booth', label: '标准展位', eyebrow: 'BOOTH', icon: '▦', color: '#e7f0ff', width: 5, height: 3.5 },
  stage: { kind: 'stage', label: '主舞台', eyebrow: 'STAGE', icon: '✦', color: '#f2e9ff', width: 8, height: 4 },
  seating: { kind: 'seating', label: '观众座席', eyebrow: 'SEATING', icon: '▤', color: '#e6f7f2', width: 6, height: 3 },
  entrance: { kind: 'entrance', label: '入口', eyebrow: 'ENTRY', icon: '↗', color: '#fff2d8', width: 2.5, height: 1.5 },
};

export const createStarterDocument = (): LayoutDocument => ({
  version: 1,
  title: '春日创意市集 · A 区',
  field: { width: 28, height: 18 },
  elements: [
    { id: 'entry-1', kind: 'entrance', name: '主入口', x: 1, y: 8.25, width: 2.5, height: 1.5, rotation: 0 },
    { id: 'stage-1', kind: 'stage', name: '分享舞台', x: 10, y: 1.5, width: 8, height: 4, rotation: 0 },
    { id: 'booth-1', kind: 'booth', name: '香氛展位', x: 4, y: 2, width: 5, height: 3.5, rotation: 0 },
    { id: 'booth-2', kind: 'booth', name: '手作展位', x: 19, y: 2, width: 5, height: 3.5, rotation: 0 },
    { id: 'seating-1', kind: 'seating', name: '休息座席', x: 10, y: 11, width: 6, height: 3, rotation: 0 },
  ],
});

export const createElement = (kind: ElementKind, index: number, field: FieldSize): ExpoElement => {
  const spec = ELEMENT_SPECS[kind];
  const offset = Math.min(index * 0.65, 4);
  return {
    id: `${kind}-${Date.now()}-${index}`,
    kind,
    name: `${spec.label} ${index + 1}`,
    x: Math.max(0.5, Math.min(field.width - spec.width - 0.5, (field.width - spec.width) / 2 + offset)),
    y: Math.max(0.5, Math.min(field.height - spec.height - 0.5, (field.height - spec.height) / 2 + offset)),
    width: spec.width,
    height: spec.height,
    rotation: 0,
  };
};

export const normalizeRotation = (rotation: number): number => ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;

export const getBoundingBox = (element: ExpoElement) => {
  const isQuarterTurn = normalizeRotation(element.rotation) % 180 !== 0;
  const width = isQuarterTurn ? element.height : element.width;
  const height = isQuarterTurn ? element.width : element.height;
  return { left: element.x, top: element.y, right: element.x + width, bottom: element.y + height, width, height };
};

const intersectionSize = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

export const findOverlaps = (elements: ExpoElement[]): OverlapIssue[] => {
  const issues: OverlapIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const overlapX = intersectionSize(first.left, first.right, second.left, second.right);
      const overlapY = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      if (overlapX > 0 && overlapY > 0) {
        issues.push({ firstId: elements[i].id, secondId: elements[j].id, amount: Number((overlapX * overlapY).toFixed(1)) });
      }
    }
  }
  return issues;
};

export const findBoundsIssues = (field: FieldSize, elements: ExpoElement[]): BoundsIssue[] =>
  elements.flatMap((element) => {
    const box = getBoundingBox(element);
    const overflow = Math.max(0, -box.left, -box.top, box.right - field.width, box.bottom - field.height);
    return overflow > 0 ? [{ elementId: element.id, overflow: Number(overflow.toFixed(1)) }] : [];
  });

export const findNarrowChannels = (elements: ExpoElement[]): ChannelIssue[] => {
  const issues: ChannelIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const verticalOverlap = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      const horizontalOverlap = intersectionSize(first.left, first.right, second.left, second.right);
      const horizontalGap = first.right <= second.left ? second.left - first.right : second.right <= first.left ? first.left - second.right : 0;
      const verticalGap = first.bottom <= second.top ? second.top - first.bottom : second.bottom <= first.top ? first.top - second.bottom : 0;
      const gap = verticalOverlap > 0 ? horizontalGap : horizontalOverlap > 0 ? verticalGap : 0;
      if (gap > 0 && gap < MIN_CHANNEL) issues.push({ firstId: elements[i].id, secondId: elements[j].id, gap: Number(gap.toFixed(1)) });
    }
  }
  return issues;
};

const distance = (first: { x: number; y: number }, second: { x: number; y: number }) => Math.hypot(second.x - first.x, second.y - first.y);

export const createPathPreview = (elements: ExpoElement[]): PathPreview | null => {
  const entrance = elements.find((element) => element.kind === 'entrance');
  const target = elements.find((element) => element.kind === 'stage') ?? elements.find((element) => element.kind !== 'entrance');
  if (!entrance || !target) return null;
  const startBox = getBoundingBox(entrance);
  const targetBox = getBoundingBox(target);
  const start = { x: startBox.left + startBox.width / 2, y: startBox.top + startBox.height / 2 };
  const end = { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 };
  const elbow = { x: end.x, y: start.y };
  return { points: [start, elbow, end], distance: Number((distance(start, elbow) + distance(elbow, end)).toFixed(1)), fromName: entrance.name, toName: target.name };
};

export const analyzeLayout = (document: LayoutDocument): Analysis => ({
  overlaps: findOverlaps(document.elements),
  bounds: findBoundsIssues(document.field, document.elements),
  channels: findNarrowChannels(document.elements),
  path: createPathPreview(document.elements),
});

const rectArea = (rect: Rect) => Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);

const intersectRect = (rect: Rect, clip: Rect): Rect => ({
  left: Math.max(rect.left, clip.left),
  top: Math.max(rect.top, clip.top),
  right: Math.min(rect.right, clip.right),
  bottom: Math.min(rect.bottom, clip.bottom),
});

/** 矩形并集面积：坐标压缩 + 扫描行，重叠区域只计算一次。 */
const rectUnionArea = (rects: Rect[]): number => {
  const valid = rects.filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  if (!valid.length) return 0;
  const xs = Array.from(new Set(valid.flatMap((rect) => [rect.left, rect.right]))).sort((a, b) => a - b);
  const ys = Array.from(new Set(valid.flatMap((rect) => [rect.top, rect.bottom]))).sort((a, b) => a - b);
  let area = 0;
  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const covered = valid.some((rect) => rect.left <= xs[xi] && rect.right >= xs[xi + 1] && rect.top <= ys[yi] && rect.bottom >= ys[yi + 1]);
      if (covered) area += (xs[xi + 1] - xs[xi]) * (ys[yi + 1] - ys[yi]);
    }
  }
  return area;
};

/** 场地按中线四等分：左上 / 右上 / 左下 / 右下。 */
export const buildFieldZones = (field: FieldSize): ZoneDefinition[] => {
  const midX = field.width / 2;
  const midY = field.height / 2;
  return [
    { id: 'zone-tl', name: '左上区', bounds: { left: 0, top: 0, right: midX, bottom: midY } },
    { id: 'zone-tr', name: '右上区', bounds: { left: midX, top: 0, right: field.width, bottom: midY } },
    { id: 'zone-bl', name: '左下区', bounds: { left: 0, top: midY, right: midX, bottom: field.height } },
    { id: 'zone-br', name: '右下区', bounds: { left: midX, top: midY, right: field.width, bottom: field.height } },
  ];
};

const round1 = (value: number) => Number(value.toFixed(1));
const ratioOf = (part: number, total: number) => (total > 0 ? part / total : 0);

/**
 * 按元素类型与分区汇总数量、占地面积和占比，并给出剩余可用面积。
 * 占地口径与检查一致：统一使用 getBoundingBox（旋转 90° 后交换宽高），
 * 先与场地矩形求交裁掉越界部分，再以矩形并集合并重叠，保证剩余面积不会出现负数。
 */
export const computeFieldStatistics = (document: LayoutDocument): FieldStatistics => {
  const { field, elements } = document;
  const fieldArea = field.width * field.height;
  const fieldRect: Rect = { left: 0, top: 0, right: field.width, bottom: field.height };
  const zones = buildFieldZones(field);

  const clippedByKind = new Map<ElementKind, Rect[]>();
  const clippedByZone = new Map<string, Rect[]>();
  const zoneCounts = new Map<string, Set<string>>();
  let outsideArea = 0;
  let outsideElementCount = 0;

  elements.forEach((element) => {
    const box: Rect = getBoundingBox(element);
    const clipped = intersectRect(box, fieldRect);
    const insideArea = rectArea(clipped);
    if (insideArea <= 0) outsideElementCount += 1;
    outsideArea += rectArea(box) - insideArea;

    if (insideArea > 0) {
      clippedByKind.set(element.kind, [...(clippedByKind.get(element.kind) ?? []), clipped]);
    }
    zones.forEach((zone) => {
      const piece = intersectRect(clipped, zone.bounds);
      if (rectArea(piece) > 0) {
        clippedByZone.set(zone.id, [...(clippedByZone.get(zone.id) ?? []), piece]);
        const members = zoneCounts.get(zone.id) ?? new Set<string>();
        members.add(element.id);
        zoneCounts.set(zone.id, members);
      }
    });
  });

  const kinds: KindStat[] = (Object.keys(ELEMENT_SPECS) as ElementKind[]).map((kind) => {
    const area = rectUnionArea(clippedByKind.get(kind) ?? []);
    return { kind, count: elements.filter((element) => element.kind === kind).length, area: round1(area), ratio: ratioOf(area, fieldArea) };
  });

  const occupiedArea = rectUnionArea(elements.map((element) => intersectRect(getBoundingBox(element), fieldRect)));

  const zoneStats: ZoneStat[] = zones.map((zone) => {
    const zoneArea = rectArea(zone.bounds);
    const zoneAreaRounded = round1(zoneArea);
    const zoneOccupied = Math.min(zoneArea, rectUnionArea(clippedByZone.get(zone.id) ?? []));
    const occupiedRounded = round1(zoneOccupied);
    return {
      id: zone.id,
      name: zone.name,
      area: zoneAreaRounded,
      occupiedArea: occupiedRounded,
      availableArea: zoneAreaRounded - occupiedRounded,
      ratio: ratioOf(zoneOccupied, zoneArea),
      count: zoneCounts.get(zone.id)?.size ?? 0,
    };
  });

  const fieldAreaRounded = round1(fieldArea);
  const occupiedRounded = round1(Math.min(fieldArea, occupiedArea));

  return {
    fieldArea: fieldAreaRounded,
    elementCount: elements.length,
    occupiedArea: occupiedRounded,
    availableArea: fieldAreaRounded - occupiedRounded,
    occupiedRatio: ratioOf(occupiedArea, fieldArea),
    availableRatio: 1 - ratioOf(occupiedArea, fieldArea),
    outsideArea: round1(outsideArea),
    outsideElementCount,
    kinds,
    zones: zoneStats,
  };
};

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;
