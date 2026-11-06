'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const money = n => 'S/ ' + (+n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fdate = d => d ? String(d).slice(0, 10) : '';
const sum = (a, k) => a.reduce((s, x) => s + (+x[k] || 0), 0);
const monthStart = () => today().slice(0, 8) + '01';
function lastMonths(n) {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), label: x.toLocaleDateString('es-PE', { month: 'short' }) }); }
  return out;
}
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3200); }
function modal(title, html, wide) { $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').classList.toggle('wide', !!wide); if (!$('#modal').open) $('#modal').showModal(); return $('#mBody'); }
function closeModal() { if ($('#modal').open) $('#modal').close(); }
function errBox(e) { return `<div class="card"><div class="msg bad">${esc(e.message || e)}</div></div>`; }
function table(heads, rows, empty = 'Sin registros.') {
  return rows.length ? `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.join('')}</tr>`).join('')}</tbody></table>` : `<div class="empty">${empty}</div>`;
}
function downloadCSV(name, cols, rows) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const t = [cols.map(c => q(c.l)).join(','), ...rows.map(r => cols.map(c => q(typeof c.v === 'function' ? c.v(r) : r[c.k])).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + t], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function barChart(labels, series) {
  const W = 640, H = 240, P = 40, max = Math.max(1, ...series.flatMap(s => s.data)), n = labels.length, gw = (W - P * 2) / n, bw = Math.min(34, (gw - 8) / series.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = H - P - (H - P * 2) * i / 4; g += `<line x1="${P}" x2="${W - P}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${P - 5}" y="${y + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${Math.round(max * i / 4)}</text>`; }
  labels.forEach((l, i) => {
    series.forEach((s, j) => { const h = (H - P * 2) * s.data[i] / max, x = P + i * gw + (gw - bw * series.length) / 2 + j * bw; g += `<rect x="${x}" y="${H - P - h}" width="${bw}" height="${h}" rx="3" fill="${s.color}"><title>${esc(s.name)}: ${money(s.data[i])}</title></rect>`; });
    g += `<text x="${P + i * gw + gw / 2}" y="${H - 14}" font-size="11" text-anchor="middle" fill="var(--muted)">${esc(l)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras" style="width:100%;height:auto">${g}</svg>` + (series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
}
function donut(items) {
  items = items.filter(i => i.v > 0); const tot = sum(items, 'v'); if (!tot) return '<div class="empty">Sin datos en este período.</div>';
  const C = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0ea5e9', '#ec4899', '#64748b']; let a0 = -Math.PI / 2, s = '';
  items.forEach((it, i) => {
    const a = it.v / tot * 2 * Math.PI, a1 = a0 + a, p = (r, x) => [60 + r * Math.cos(x), 60 + r * Math.sin(x)];
    if (items.length === 1) s += `<circle cx="60" cy="60" r="50" fill="${C[0]}"/>`;
    else { const [x0, y0] = p(50, a0), [x1, y1] = p(50, a1); s += `<path d="M60 60L${x0} ${y0}A50 50 0 ${a > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z" fill="${C[i % 8]}"><title>${esc(it.l)}: ${money(it.v)}</title></path>`; }
    a0 = a1;
  });
  return `<div class="donut"><svg viewBox="0 0 120 120" width="160" height="160" role="img" aria-label="Gráfico circular">${s}<circle cx="60" cy="60" r="28" fill="var(--card)"/></svg><ul>${items.map((it, i) => `<li><i style="background:${C[i % 8]}"></i>${esc(it.l)} <b>${money(it.v)}</b> <small class="muted">(${Math.round(it.v / tot * 100)}%)</small></li>`).join('')}</ul></div>`;
}
document.addEventListener('DOMContentLoaded', () => {
  $('#mClose').onclick = closeModal;
  $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
});
