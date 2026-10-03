import { ELEMENT_SPECS, ZONE_SPECS } from '../../domain';
import type { LayoutStats } from '../../types';

interface StatsPanelProps { stats: LayoutStats; }

export function StatsPanel({ stats }: StatsPanelProps) {
  const usageWidth = Math.max(0, Math.min(100, stats.usageShare));
  return <section className="panel stats-panel">
    <div className="stats-head">
      <div className="panel-heading"><div><span className="section-kicker">SPACE SUMMARY</span><h2>场地统计</h2></div><span className="count-badge">{stats.usageShare}%</span></div>
      <div className="stats-overview">
        <div><span>场地总面积</span><strong>{stats.fieldArea.toFixed(1)} m²</strong></div>
        <div><span>已占用</span><strong>{stats.occupiedArea.toFixed(1)} m²</strong></div>
        <div><span>剩余可用</span><strong className="free-area">{stats.freeArea.toFixed(1)} m²</strong></div>
      </div>
      <div className="usage-bar" role="img" aria-label={`场地占用率 ${stats.usageShare}%`}><i style={{ width: `${usageWidth}%` }} /></div>
    </div>
    <div className="stats-table">
      <div className="stats-table-title"><span className="section-kicker">BY TYPE</span><strong>按元素类型</strong></div>
      <div className="stats-row stats-row-head"><span>类型</span><span>数量</span><span>占地</span><span>占比</span></div>
      {stats.byKind.map((row) => {
        const spec = ELEMENT_SPECS[row.kind];
        return <div className="stats-row" key={row.kind}>
          <span className="stats-label"><i className="stats-swatch" style={{ background: spec.color }} />{spec.label}</span>
          <span>{row.count}</span>
          <span>{row.area.toFixed(1)} m²</span>
          <span>{row.share}%</span>
        </div>;
      })}
    </div>
    <div className="stats-table">
      <div className="stats-table-title"><span className="section-kicker">BY ZONE</span><strong>按分区</strong></div>
      <div className="stats-row stats-row-head"><span>分区</span><span>数量</span><span>占地</span><span>占比</span></div>
      {stats.byZone.map((row) => {
        const spec = ZONE_SPECS[row.zone];
        return <div className="stats-row" key={row.zone}>
          <span className="stats-label"><i className="stats-zone-tag">{spec.eyebrow}</i>{spec.label}</span>
          <span>{row.count}</span>
          <span>{row.area.toFixed(1)} m²</span>
          <span>{row.share}%</span>
        </div>;
      })}
    </div>
  </section>;
}
