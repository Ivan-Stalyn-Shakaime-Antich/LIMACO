'use strict';
const cajaMov = (tipo, concepto, monto, metodo, ref, fecha) => DB.insert('caja', { fecha: fecha || today(), tipo, concepto, monto, metodo: metodo || 'efectivo', ref: ref || null });
const movInv = (producto_id, tipo, cantidad, motivo, ref) => DB.insert('movimientos_inventario', { producto_id, tipo, cantidad, motivo, ref: ref || null, usuario: ME.usuario, fecha: new Date().toISOString() });
const nmOf = (arr, id, k) => (arr.find(x => x.id == id) || {})[k] || '';
const kpi = (l, v, i, c) => `<div class="kpi" style="--c:${c || '#2563eb'}"><i class="fa-solid fa-${i}"></i><small>${l}</small><b>${v}</b></div>`;

MOD.dashboard = { t: 'Dashboard', i: 'chart-pie', roles: ['admin', 'gerente', 'vendedor'], async run(box) {
  const [vs, vi, cl, pr, rp, gs, cj, pf] = await Promise.all(['ventas', 'venta_items', 'clientes', 'productos', 'repartos', 'gastos', 'caja', 'productos'].map(t => DB.list(t)));
  const hoy = today(), mes = hoy.slice(0, 7), fin = ME.rol !== 'vendedor', ok = vs.filter(v => v.estado !== 'anulada');
  const vMes = ok.filter(v => fdate(v.fecha).startsWith(mes)), ids = new Set(vMes.map(v => v.id));
  const costo = vi.filter(i => ids.has(i.venta_id)).reduce((a, i) => a + i.cantidad * i.costo, 0), gMes = sum(gs.filter(g => fdate(g.fecha).startsWith(mes)), 'monto');
  const saldo = sum(cj.filter(c => c.tipo === 'ingreso'), 'monto') - sum(cj.filter(c => c.tipo === 'egreso'), 'monto');
  const bajos = pr.filter(p => p.activo !== false && +p.stock <= +p.stock_minimo), pend = rp.filter(r => r.estado === 'pendiente' || r.estado === 'en ruta');
  const meses = lastMonths(6), porMes = meses.map(m => sum(ok.filter(v => fdate(v.fecha).startsWith(m.key)), 'total'));
  const vm = {}; vi.forEach(i => { if (ok.some(v => v.id === i.venta_id)) vm[i.producto_id] = (vm[i.producto_id] || 0) + +i.subtotal; });
  const top = Object.entries(vm).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ l: nmOf(pr, id, 'nombre') || '#' + id, v }));
  box.innerHTML = `<div class="kpis">${kpi('Ventas de hoy', money(sum(ok.filter(v => fdate(v.fecha) === hoy), 'total')), 'cash-register', '#16a34a')}${kpi('Ventas del mes', money(sum(vMes, 'total')), 'chart-line', '#2563eb')}${fin ? kpi('Gastos del mes', money(gMes), 'receipt', '#dc2626') + kpi('Utilidad neta del mes', money(sum(vMes, 'total') - costo - gMes), 'sack-dollar', '#7c3aed') + kpi('Saldo de caja', money(saldo), 'wallet', '#0ea5e9') : ''}${kpi('Clientes', cl.length, 'users', '#f59e0b')}${kpi('Productos', pr.length, 'boxes-stacked', '#64748b')}${kpi('Stock bajo', bajos.length, 'triangle-exclamation', '#dc2626')}${kpi('Repartos pendientes', pend.length, 'truck', '#0ea5e9')}</div>
<div class="grid2"><div class="card"><h3>Ventas de los últimos 6 meses</h3>${barChart(meses.map(m => m.label), [{ name: 'Ventas', color: '#2563eb', data: porMes }])}</div><div class="card"><h3>Productos más vendidos</h3>${donut(top)}</div></div>
<div class="grid2"><div class="card"><h3>Últimas ventas</h3><div class="tw">${table(['N°', 'Fecha', 'Cliente', 'Total'], ok.slice(0, 6).map(v => [`<td>#${v.id}</td>`, `<td>${fdate(v.fecha)}</td>`, `<td>${esc(nmOf(cl, v.cliente_id, 'nombre') || 'Mostrador')}</td>`, `<td>${money(v.total)}</td>`]), 'Aún no hay ventas.')}</div></div>
<div class="card"><h3>Productos con stock bajo</h3><div class="tw">${table(['Producto', 'Stock', 'Mínimo'], bajos.slice(0, 8).map(p => [`<td>${esc(p.nombre)}</td>`, `<td><span class="badge ${+p.stock <= 0 ? 'bad' : 'warn'}">${p.stock}</span></td>`, `<td>${p.stock_minimo}</td>`]), 'Todo el stock está en orden.')}</div></div></div>`;
} };

MOD.usuarios = { t: 'Usuarios', i: 'user-shield', roles: ['admin'], async run(box) {
  box.innerHTML = '<div class="card"><div class="msg">Las personas se registran desde la pantalla de acceso y quedan <b>pendientes</b>. Aquí activas su cuenta y defines su rol (admin, gerente o vendedor).</div></div><div id="ub"></div>';
  await crud('perfiles', $('#ub'), { canAdd: false, canDelete: false, list: { order: 'creado' }, before: async (o, n, old) => { if (old.id === ME.id && (o.rol !== 'admin' || !o.activo)) throw new Error('No puedes quitarte el rol de administrador ni desactivarte.'); } });
} };

async function histTrab(el) {
  const [ws, as, ps] = await Promise.all([DB.list('trabajadores'), DB.list('asistencias'), DB.list('pagos_trabajadores')]);
  el.innerHTML = `<div class="card"><div class="bar2"><select id="hw" class="in" style="max-width:260px"><option value="">Todos los trabajadores</option>${ws.map(w => `<option value="${w.id}">${esc(w.nombre)}</option>`).join('')}</select><input id="hm" type="month" class="in" style="max-width:180px" value="${today().slice(0, 7)}"></div><div class="kpis" id="hk"></div><div class="tw" id="ht"></div></div>`;
  const draw = () => {
    const w = $('#hw', el).value, m = $('#hm', el).value, f = r => (!w || r.trabajador_id == w) && (!m || fdate(r.fecha).startsWith(m)), A = as.filter(f), Pg = ps.filter(f);
    const ev = [...A.map(a => ({ f: fdate(a.fecha), w: a.trabajador_id, t: 'Asistencia', d: a.estado + (a.horas ? ` (${a.horas} h)` : ''), m: null })), ...Pg.map(p => ({ f: fdate(p.fecha), w: p.trabajador_id, t: 'Pago / descuento', d: p.tipo + (p.concepto ? ': ' + p.concepto : ''), m: (p.tipo === 'descuento' ? -1 : 1) * p.monto }))].sort((a, b) => b.f.localeCompare(a.f));
    const pag = sum(Pg.filter(p => p.tipo !== 'descuento'), 'monto'), des = sum(Pg.filter(p => p.tipo === 'descuento'), 'monto');
    $('#hk', el).innerHTML = kpi('Asistencias', A.filter(a => a.estado === 'asistio').length, 'check', '#16a34a') + kpi('Tardanzas', A.filter(a => a.estado === 'tardanza').length, 'clock', '#f59e0b') + kpi('Faltas', A.filter(a => a.estado === 'falta').length, 'user-xmark', '#dc2626') + kpi('Pagado', money(pag), 'money-bill', '#2563eb') + kpi('Descuentos', money(des), 'minus', '#7c3aed');
    $('#ht', el).innerHTML = table(['Fecha', 'Trabajador', 'Tipo', 'Detalle', 'Monto'], ev.map(e => [`<td>${e.f}</td>`, `<td>${esc(nmOf(ws, e.w, 'nombre'))}</td>`, `<td>${e.t}</td>`, `<td>${esc(e.d)}</td>`, `<td>${e.m === null ? '' : money(e.m)}</td>`]), 'Sin eventos para este filtro.');
  };
  $('#hw', el).onchange = draw; $('#hm', el).onchange = draw; draw();
}
MOD.trabajadores = { t: 'Trabajadores', i: 'user-tie', roles: ['admin', 'gerente'], async run(box) {
  tabs(box, [
    { t: 'Lista de trabajadores', fn: el => crud('trabajadores', el, { list: { order: 'nombre', asc: true } }) },
    { t: 'Asistencias', fn: el => crud('asistencias', el, { list: { order: 'fecha' } }) },
    { t: 'Pagos y descuentos', fn: el => crud('pagos_trabajadores', el, { list: { order: 'fecha' },
      after: async (s, isNew) => { if (isNew && s.tipo !== 'descuento') { const w = nmOf(await DB.list('trabajadores'), s.trabajador_id, 'nombre'); const g = await DB.insert('gastos', { fecha: s.fecha, categoria: 'Sueldos', descripcion: `[pago #${s.id}] ${s.tipo} - ${w}`, monto: s.monto, metodo: 'efectivo' }); await cajaMov('egreso', 'Gasto: ' + g.descripcion, s.monto, 'efectivo', 'gasto:' + g.id, s.fecha); } },
      afterDelete: async p => { const g = (await DB.list('gastos')).find(x => String(x.descripcion || '').startsWith(`[pago #${p.id}]`)); if (g) { await DB.remove('gastos', g.id); const c = (await DB.list('caja')).find(x => x.ref === 'gasto:' + g.id); if (c) await DB.remove('caja', c.id); } } }) },
    { t: 'Historial', fn: histTrab }
  ]);
} };

MOD.clientes = { t: 'Clientes', i: 'users', roles: ['admin', 'gerente', 'vendedor'], run: box => crud('clientes', box, { list: { order: 'nombre', asc: true } }) };
MOD.productos = { t: 'Catálogo de productos', i: 'boxes-stacked', roles: ['admin', 'gerente', 'vendedor'], run: box => crud('productos', box, { list: { order: 'nombre', asc: true },
  before: async (o, isNew) => { if (o.precio_venta < o.precio_compra && !confirm('El precio de venta es menor que el de compra. ¿Continuar?')) throw new Error('Operación cancelada.'); },
  after: async (s, isNew) => { if (isNew && +s.stock > 0) await movInv(s.id, 'entrada', s.stock, 'Stock inicial', 'inicial:' + s.id); } }) };
MOD.proveedores = { t: 'Proveedores', i: 'truck-field', roles: ['admin', 'gerente'], run: box => crud('proveedores', box, { list: { order: 'empresa', asc: true } }) };
