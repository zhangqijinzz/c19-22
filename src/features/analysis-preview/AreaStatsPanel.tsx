import { ELEMENT_SPECS } from '../../domain';
import type { ElementKind, FieldStatistics } from '../../types';

interface AreaStatsPanelProps { statistics: FieldStatistics; }

const KIND_BAR_COLORS: Record<ElementKind, string> = {
  booth: '#5b8def',
  stage: '#9b7bd4',
  seating: '#4bb79a',
  entrance: '#e5a54b',
};

const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const formatM2 = (area: number) => `${area.toFixed(1)} m²`;

export function AreaStatsPanel({ statistics }: AreaStatsPanelProps) {
  const usedPercent = `${(statistics.occupiedRatio * 100).toFixed(1)}%`;
  const usedKinds = statistics.kinds.filter((item) => item.count > 0);
  return <section className="stats-panel">
    <div className="stats-heading">
      <div>
        <span className="section-kicker">AREA STATISTICS</span>
        <h2>场地占地统计</h2>
      </div>
      <div className="stats-chips">
        <span><b>{formatM2(statistics.fieldArea)}</b>场地总面积</span>
        <span><b>{formatM2(statistics.occupiedArea)}</b>已占用</span>
        <span className="stats-available"><b>{formatM2(statistics.availableArea)}</b>剩余可用</span>
        {statistics.outsideElementCount > 0 ? <span className="stats-outside"><b>{formatM2(statistics.outsideArea)}</b>{statistics.outsideElementCount} 个元素越界</span> : null}
      </div>
    </div>
    <div className="stats-usage">
      <div className="stats-usage-bar" title={`占用 ${usedPercent} · 剩余 ${formatPercent(statistics.availableRatio)}`}>
        <div className="stats-usage-used" style={{ width: usedPercent }} />
      </div>
      <span>占用率 <b>{usedPercent}</b></span>
      <span className="muted">剩余率 {formatPercent(statistics.availableRatio)}</span>
      <span className="muted">共 {statistics.elementCount} 个元素</span>
    </div>
    <div className="stats-tables">
      <div className="stats-table-card">
        <div className="stats-table-title"><strong>按元素类型</strong><small>占地口径与检查一致（旋转按包围盒，已裁去越界部分）</small></div>
        {usedKinds.length === 0 ? <div className="stats-empty">场地已清空，全部 {formatM2(statistics.fieldArea)} 均可使用</div> : <table className="stats-table">
          <thead><tr><th>类型</th><th className="num">数量</th><th className="num">占地面积</th><th className="num">占场地</th><th>占比</th></tr></thead>
          <tbody>
            {usedKinds.map((item) => {
              const spec = ELEMENT_SPECS[item.kind];
              return <tr key={item.kind}>
                <td><span className="stats-swatch" style={{ background: spec.color, borderColor: KIND_BAR_COLORS[item.kind] }}>{spec.icon}</span>{spec.label}</td>
                <td className="num">{item.count}</td>
                <td className="num">{formatM2(item.area)}</td>
                <td className="num">{formatPercent(item.ratio)}</td>
                <td><div className="stats-bar"><div style={{ width: formatPercent(item.ratio), background: KIND_BAR_COLORS[item.kind] }} /></div></td>
              </tr>;
            })}
          </tbody>
        </table>}
      </div>
      <div className="stats-table-card">
        <div className="stats-table-title"><strong>按场地区域</strong><small>中线四等分 · 跨区元素按实际覆盖面积拆分</small></div>
        <table className="stats-table">
          <thead><tr><th>分区</th><th className="num">元素</th><th className="num">已占用</th><th className="num">剩余可用</th><th>占用率</th></tr></thead>
          <tbody>
            {statistics.zones.map((zone) => <tr key={zone.id}>
              <td>{zone.name}</td>
              <td className="num">{zone.count}</td>
              <td className="num">{formatM2(zone.occupiedArea)}</td>
              <td className="num">{formatM2(zone.availableArea)}</td>
              <td><div className="stats-bar" title={`分区面积 ${formatM2(zone.area)}`}><div style={{ width: formatPercent(zone.ratio) }} /></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
    {statistics.outsideElementCount > 0 ? <p className="stats-note">⚠ {statistics.outsideElementCount} 个元素完全位于场地外，已计入元素总数但不占场地面积；另有 {formatM2(statistics.outsideArea)} 的越界部分未计入可用面积。</p> : null}
  </section>;
}
