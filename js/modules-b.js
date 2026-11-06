'use strict';
const METODOS = ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta'];
async function docModal(kind, done) {
  const isV = kind === 'venta';
  const [prods, parts] = await Promise.all([DB.list('productos'), DB.list(isV ? 'clientes' : 'proveedores')]);
  const act = prods.filter(p => p.activo !== false); let items = [{ pid: '', qty: 1, price: 0 }];
  const pOpt = pid => `<option value="">— producto —</option>${act.map(p => `<option value="${p.id}" ${p.id == pid ? 'selected' : ''}>${esc((p.codigo ? p.codigo + ' · ' : '') + p.nombre)} (stock ${p.stock})</option>`).join('')}`;
  const b = modal(isV ? 'Nueva venta' : 'Nueva compra', `<form id="df"><div class="fg"><div><label class="lb">${isV ? 'Cliente' : 'Proveedor *'}</label><select class="in" id="dp"><option value="">${isV ? 'Cliente de mostrador' : '— elegir —'}</option>${parts.map(p => `<option value="${p.id}">${esc(isV ? p.nombre : p.empresa)}</option>`).join('')}</select></div><div><label class="lb">Fecha</label><input class="in" type="date" id="dd" value="${today()}" required></div><div><label class="lb">Método de pago</label><select class="in" id="dm">${METODOS.map(x => `<option>${x}</option>`).join('')}</select></div>${isV ? '<div><label class="lb">Descuento (S/)</label><input class="in" type="number" min="0" step="any" id="ddesc" value="0"></div>' : '<div><label class="lb"><input type="checkbox" id="dpag" checked> Compra pagada (registra salida de caja)</label></div>'}</div>
<h3 style="margin:14px 0 6px">Productos</h3><div class="tw"><table class="items"><thead><tr><th>Producto</th><th>Cant.</th><th>${isV ? 'Precio' : 'Costo'}</th><th>Subtotal</th><th></th></tr></thead><tbody id="di"></tbody></table></div><p style="margin-top:6px"><button type="button" class="btn sm" id="dadd">+ Agregar línea</button></p>
${isV ? '<div class="fg" style="margin-top:10px"><div><label class="lb"><input type="checkbox" id="drep"> Requiere reparto</label></div><div><input class="in" id="ddir" placeholder="Dirección de entrega (si es distinta)"></div></div>' : ''}
<div class="tot">Total: <b id="dtot">S/ 0.00</b></div><p class="right" style="margin-top:12px"><button class="btn" type="button" id="dcan">Cancelar</button> <button class="btn pri" id="dsave">Guardar</button></p></form>`, true);
  const F = $('#df', b);
  const rows = () => { $('#di', F).innerHTML = items.map((it, i) => `<tr data-i="${i}"><td><select class="in" data-f="pid">${pOpt(it.pid)}</select></td><td><input class="in" type="number" min="0" step="any" data-f="qty" value="${it.qty}" style="width:84px"></td><td><input class="in" type="number" min="0" step="any" data-f="price" value="${it.price}" style="width:104px"></td><td class="sub">${money(it.qty * it.price)}</td><td><button type="button" class="btn sm bad" data-rm="${i}" aria-label="Quitar">×</button></td></tr>`).join(''); };
  const calc = () => { const sub = items.reduce((a, i) => a + i.qty * i.price, 0), d = isV ? (+$('#ddesc', F).value || 0) : 0, total = Math.max(0, sub - d); $('#dtot', F).textContent = money(total); return { sub, d, total }; };
  F.oninput = e => { const tr = e.target.closest('tr[data-i]'); if (tr && (e.target.dataset.f === 'qty' || e.target.dataset.f === 'price')) { const it = items[+tr.dataset.i]; it[e.target.dataset.f] = +e.target.value || 0; $('.sub', tr).textContent = money(it.qty * it.price); } calc(); };
  F.onchange = e => { if (e.target.dataset.f === 'pid') { const it = items[+e.target.closest('tr').dataset.i], p = act.find(x => x.id == e.target.value); it.pid = e.target.value; if (p) it.price = +(isV ? p.precio_venta : p.precio_compra); rows(); calc(); } if (e.target.id === 'dp' && isV) { const c = parts.find(x => x.id == e.target.value); if (c && c.direccion && !$('#ddir', F).value) $('#ddir', F).value = c.direccion; } };
  F.onclick = e => { const x = e.target.closest('button'); if (!x) return; if (x.id === 'dadd') { items.push({ pid: '', qty: 1, price: 0 }); rows(); } else if (x.dataset.rm !== undefined) { items.splice(+x.dataset.rm, 1); if (!items.length) items.push({ pid: '', qty: 1, price: 0 }); rows(); calc(); } else if (x.id === 'dcan') closeModal(); };
  rows(); calc();
  F.onsubmit = async e => {
    e.preventDefault(); const btn = $('#dsave', F); btn.disabled = true;
    try {
      const lines = items.filter(i => i.pid || i.qty * i.price); if (!lines.length) throw new Error('Agrega al menos un producto.');
      const need = {}; for (const l of lines) { if (!l.pid) throw new Error('Elige el producto en todas las líneas.'); if (!(l.qty > 0)) throw new Error('La cantidad debe ser mayor a 0.'); need[l.pid] = (need[l.pid] || 0) + l.qty; }
      const fresh = await DB.list('productos'), P = id => fresh.find(p => p.id == id);
      if (isV) for (const id in need) if (need[id] > +P(id).stock) throw new Error(`Stock insuficiente de "${P(id).nombre}" (disponible ${P(id).stock}).`);
      if (!isV && !$('#dp', F).value) throw new Error('Elige un proveedor.');
      const { sub, d, total } = calc(), fecha = $('#dd', F).value, met = $('#dm', F).value, par = $('#dp', F).value ? +$('#dp', F).value : null;
      if (isV) {
        const rep = $('#drep', F).checked, dir = $('#ddir', F).value.trim() || (parts.find(p => p.id == par) || {}).direccion || '';
        if (rep && !dir) throw new Error('Indica la dirección de entrega para el reparto.');
        const v = await DB.insert('ventas', { cliente_id: par, fecha, subtotal: sub, descuento: d, total, metodo: met, estado: 'completada', reparto: rep, vendedor: ME.usuario });
        await DB.insert('venta_items', lines.map(l => ({ venta_id: v.id, producto_id: +l.pid, cantidad: l.qty, precio: l.price, costo: +P(l.pid).precio_compra, subtotal: l.qty * l.price })));
        for (const id in need) { await DB.update('productos', +id, { stock: +P(id).stock - need[id] }); await movInv(+id, 'salida', need[id], 'Venta #' + v.id, 'venta:' + v.id); }
        await cajaMov('ingreso', 'Venta #' + v.id, total, met, 'venta:' + v.id, fecha);
        if (rep) await DB.insert('repartos', { venta_id: v.id, cliente_id: par, direccion: dir, fecha, estado: 'pendiente' });
        log('crear', 'ventas', '#' + v.id + ' ' + money(total));
      } else {
        const pag = $('#dpag', F).checked, c = await DB.insert('compras', { proveedor_id: par, fecha, total: sub, pagado: pag, metodo: met, estado: 'completada' });
        await DB.insert('compra_items', lines.map(l => ({ compra_id: c.id, producto_id: +l.pid, cantidad: l.qty, costo: l.price, subtotal: l.qty * l.price })));
        const last = {}; lines.forEach(l => last[l.pid] = l.price);
        for (const id in need) { await DB.update('productos', +id, { stock: +P(id).stock + need[id], precio_compra: last[id] }); await movInv(+id, 'entrada', need[id], 'Compra #' + c.id, 'compra:' + c.id); }
        if (pag) await cajaMov('egreso', 'Compra #' + c.id, sub, met, 'compra:' + c.id, fecha);
        log('crear', 'compras', '#' + c.id + ' ' + money(sub));
      }
      closeModal(); toast(isV ? 'Venta registrada' : 'Compra registrada'); done();
    } catch (er) { toast(cleanErr(er), true); btn.disabled = false; }
  };
}
async function anular(kind, doc) {
  const isV = kind === 'venta', its = (await DB.list(isV ? 'venta_items' : 'compra_items')).filter(i => i[isV ? 'venta_id' : 'compra_id'] == doc.id), prods = await DB.list('productos'), q = {};
  its.forEach(i => q[i.producto_id] = (q[i.producto_id] || 0) + +i.cantidad);
  for (const id in q) { const p = prods.find(x => x.id == id); if (p && !isV && +p.stock - q[id] < 0) throw new Error(`No se puede anular: el stock de "${p.nombre}" quedaría negativo.`); }
  for (const id in q) { const p = prods.find(x => x.id == id); if (!p) continue; await DB.update('productos', +id, { stock: +p.stock + (isV ? q[id] : -q[id]) }); await movInv(+id, isV ? 'entrada' : 'salida', q[id], `Anulación ${kind} #${doc.id}`, `anul-${kind}:${doc.id}`); }
  if (isV) { await cajaMov('egreso', 'Anulación venta #' + doc.id, doc.total, doc.metodo, 'anul-venta:' + doc.id); for (const r of (await DB.list('repartos')).filter(r => r.venta_id == doc.id)) await DB.update('repartos', r.id, { estado: 'cancelado' }); }
  else if (doc.pagado) await cajaMov('ingreso', 'Anulación compra #' + doc.id, doc.total, doc.metodo, 'anul-compra:' + doc.id);
  await DB.update(isV ? 'ventas' : 'compras', doc.id, { estado: 'anulada' }); log('anular', isV ? 'ventas' : 'compras', '#' + doc.id);
}
async function docList(kind, box) {
  const isV = kind === 'venta', T = isV ? 'ventas' : 'compras', P = isV ? 'clientes' : 'proveedores', pk = isV ? 'cliente_id' : 'proveedor_id', pn = isV ? 'nombre' : 'empresa';
  const [rows, parts] = await Promise.all([DB.list(T), DB.list(P)]), nm = r => nmOf(parts, r[pk], pn) || (isV ? 'Mostrador' : '—');
  box.innerHTML = `<div class="card"><div class="bar2"><input class="in" id="dq" placeholder="Buscar…" aria-label="Buscar"><input class="in" type="date" id="df1" style="max-width:150px" aria-label="Desde"><input class="in" type="date" id="df2" style="max-width:150px" aria-label="Hasta"><span class="sp"></span><button class="btn pri" id="dnew"><i class="fa-solid fa-plus"></i> Nueva ${isV ? 'venta' : 'compra'}</button><button class="btn" id="dcsv"><i class="fa-solid fa-file-csv"></i> CSV</button></div><div class="tw" id="dt"></div></div>`;
  const view = () => { const q = norm($('#dq', box).value), a = $('#df1', box).value, b = $('#df2', box).value; return rows.filter(r => (!a || fdate(r.fecha) >= a) && (!b || fdate(r.fecha) <= b) && (!q || norm('#' + r.id + ' ' + nm(r) + ' ' + r.metodo + ' ' + r.estado).includes(q))); };
  const draw = () => { $('#dt', box).innerHTML = table(['N°', 'Fecha', isV ? 'Cliente' : 'Proveedor', 'Total', 'Método', 'Estado', ''], view().map(r => [`<td>#${r.id}</td>`, `<td>${fdate(r.fecha)}</td>`, `<td>${esc(nm(r))}${r.reparto ? ' <i class="fa-solid fa-truck" title="Con reparto"></i>' : ''}</td>`, `<td>${money(r.total)}</td>`, `<td>${esc(r.metodo)}</td>`, `<td><span class="badge ${ESTADOS[r.estado] || ''}">${esc(r.estado)}</span></td>`, `<td class="act"><button class="btn sm" data-v="${r.id}" title="Ver detalle"><i class="fa-solid fa-eye"></i></button>${r.estado !== 'anulada' && ME.rol !== 'vendedor' ? `<button class="btn sm bad" data-a="${r.id}" title="Anular"><i class="fa-solid fa-ban"></i></button>` : ''}</td>`]), 'Sin registros.'); };
  $('#dq', box).oninput = draw; $('#df1', box).onchange = draw; $('#df2', box).onchange = draw; draw();
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'dnew') docModal(kind, () => docList(kind, box));
    else if (b.id === 'dcsv') downloadCSV(T, [{ l: 'N°', k: 'id' }, { l: 'Fecha', v: r => fdate(r.fecha) }, { l: isV ? 'Cliente' : 'Proveedor', v: nm }, { l: 'Total', k: 'total' }, { l: 'Método', k: 'metodo' }, { l: 'Estado', k: 'estado' }], view());
    else if (b.dataset.v) {
      const r = rows.find(x => x.id == b.dataset.v), its = (await DB.list(isV ? 'venta_items' : 'compra_items')).filter(i => i[isV ? 'venta_id' : 'compra_id'] == r.id), pr = await DB.list('productos'), cfg = await getCfg();
      modal((isV ? 'Venta' : 'Compra') + ' #' + r.id, `<div id="print"><p><b>${esc(cfg.nombre_negocio || 'Mi negocio')}</b> ${cfg.ruc ? '· RUC ' + esc(cfg.ruc) : ''}<br>${fdate(r.fecha)} · ${esc(nm(r))} · ${esc(r.metodo)} · <span class="badge ${ESTADOS[r.estado] || ''}">${esc(r.estado)}</span></p><div class="tw">${table(['Producto', 'Cant.', isV ? 'Precio' : 'Costo', 'Subtotal'], its.map(i => [`<td>${esc(nmOf(pr, i.producto_id, 'nombre'))}</td>`, `<td>${i.cantidad}</td>`, `<td>${money(isV ? i.precio : i.costo)}</td>`, `<td>${money(i.subtotal)}</td>`]))}</div>${isV && +r.descuento ? `<p class="right">Descuento: ${money(r.descuento)}</p>` : ''}<p class="tot">Total: <b>${money(r.total)}</b></p></div><p class="right"><button class="btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button></p>`, true);
    } else if (b.dataset.a) { const r = rows.find(x => x.id == b.dataset.a); if (confirm(`¿Anular ${kind} #${r.id}? Se revertirán stock y caja.`)) { try { await anular(kind, r); toast('Anulada correctamente'); docList(kind, box); } catch (er) { toast(cleanErr(er), true); } } }
  };
}
MOD.compras = { t: 'Compras', i: 'cart-flatbed', roles: ['admin', 'gerente'], run: box => docList('compra', box) };
MOD.ventas = { t: 'Ventas', i: 'cash-register', roles: ['admin', 'gerente', 'vendedor'], run: box => docList('venta', box) };

async function invStock(el) {
  const rows = await DB.list('productos', { order: 'nombre', asc: true });
  const st = p => +p.stock <= 0 ? ['Agotado', 'bad'] : +p.stock <= +p.stock_minimo ? ['Bajo', 'warn'] : ['OK', 'ok'];
  el.innerHTML = `<div class="kpis">${kpi('Valor del inventario (costo)', money(rows.reduce((a, p) => a + p.stock * p.precio_compra, 0)), 'sack-dollar', '#16a34a')}${kpi('Productos', rows.length, 'boxes-stacked')}${kpi('Con stock bajo / agotado', rows.filter(p => st(p)[1] !== 'ok').length, 'triangle-exclamation', '#dc2626')}</div><div class="card"><div class="bar2"><input class="in" id="iq" placeholder="Buscar producto…" aria-label="Buscar"><span class="sp"></span><button class="btn" id="icsv"><i class="fa-solid fa-file-csv"></i> CSV</button></div><div class="tw" id="it"></div></div>`;
  const view = () => { const q = norm($('#iq', el).value); return rows.filter(p => !q || norm(p.nombre + ' ' + (p.codigo || '') + ' ' + (p.categoria || '')).includes(q)); };
  const draw = () => { $('#it', el).innerHTML = table(['Código', 'Producto', 'Stock', 'Mínimo', 'Estado', 'Valor (costo)', ''], view().map(p => [`<td>${esc(p.codigo || '')}</td>`, `<td>${esc(p.nombre)}</td>`, `<td><b>${p.stock}</b> ${esc(p.unidad || '')}</td>`, `<td>${p.stock_minimo}</td>`, `<td><span class="badge ${st(p)[1]}">${st(p)[0]}</span></td>`, `<td>${money(p.stock * p.precio_compra)}</td>`, `<td class="act"><button class="btn sm" data-aj="${p.id}"><i class="fa-solid fa-sliders"></i> Ajustar</button></td>`])); };
  $('#iq', el).oninput = draw; draw();
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'icsv') return downloadCSV('inventario', [{ l: 'Código', k: 'codigo' }, { l: 'Producto', k: 'nombre' }, { l: 'Stock', k: 'stock' }, { l: 'Mínimo', k: 'stock_minimo' }, { l: 'Valor costo', v: p => p.stock * p.precio_compra }], view());
    if (!b.dataset.aj) return; const p = rows.find(x => x.id == b.dataset.aj);
    const m = modal('Ajustar stock: ' + p.nombre, `<form id="af" class="fg"><div class="full">Stock actual: <b>${p.stock}</b></div><div><label class="lb">Operación</label><select class="in" id="ao"><option value="add">Sumar</option><option value="sub">Restar</option><option value="set">Fijar cantidad exacta</option></select></div><div><label class="lb">Cantidad</label><input class="in" id="aq" type="number" min="0" step="any" required></div><div class="full"><label class="lb">Motivo *</label><input class="in" id="am" placeholder="Ej.: conteo físico, merma, devolución" required></div><div class="full right"><button class="btn pri">Aplicar</button></div></form>`);
    $('#af', m).onsubmit = async ev => { ev.preventDefault(); try { const q = +$('#aq', m).value, o = $('#ao', m).value, n = o === 'add' ? +p.stock + q : o === 'sub' ? +p.stock - q : q; if (n < 0) throw new Error('El stock no puede quedar negativo.'); await DB.update('productos', p.id, { stock: n }); await movInv(p.id, 'ajuste', n - p.stock, $('#am', m).value.trim(), 'ajuste:' + p.id); log('ajuste', 'productos', `${p.nombre}: ${p.stock} → ${n}`); closeModal(); toast('Stock actualizado'); invStock(el); } catch (er) { toast(cleanErr(er), true); } };
  };
}
async function invMov(el) {
  const [ms, ps] = await Promise.all([DB.list('movimientos_inventario'), DB.list('productos')]);
  el.innerHTML = `<div class="card"><div class="bar2"><input class="in" id="mq" placeholder="Buscar…" aria-label="Buscar"><select class="in" id="mt" style="max-width:180px"><option value="">Todos</option><option>entrada</option><option>salida</option><option>ajuste</option></select></div><div class="tw" id="mtb"></div></div>`;
  const draw = () => { const q = norm($('#mq', el).value), t = $('#mt', el).value; $('#mtb', el).innerHTML = table(['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Usuario'], ms.filter(m => (!t || m.tipo === t) && (!q || norm(nmOf(ps, m.producto_id, 'nombre') + ' ' + m.motivo).includes(q))).slice(0, 500).map(m => [`<td>${esc(String(m.fecha).replace('T', ' ').slice(0, 16))}</td>`, `<td>${esc(nmOf(ps, m.producto_id, 'nombre'))}</td>`, `<td><span class="badge ${m.tipo === 'entrada' ? 'ok' : m.tipo === 'salida' ? 'bad' : 'info'}">${m.tipo}</span></td>`, `<td>${m.cantidad}</td>`, `<td>${esc(m.motivo || '')}</td>`, `<td>${esc(m.usuario || '')}</td>`])); };
  $('#mq', el).oninput = draw; $('#mt', el).onchange = draw; draw();
}
MOD.inventario = { t: 'Inventario', i: 'warehouse', roles: ['admin', 'gerente', 'vendedor'], run: box => tabs(box, [{ t: 'Stock actual', fn: invStock }, { t: 'Movimientos', fn: invMov }]) };
MOD.repartos = { t: 'Repartos', i: 'truck', roles: ['admin', 'gerente', 'vendedor'], run: box => crud('repartos', box, { list: { order: 'fecha' }, defaults: { estado: 'pendiente' },
  extra: [{ l: 'En ruta', i: 'route', show: r => r.estado === 'pendiente', fn: r => DB.update('repartos', r.id, { estado: 'en ruta' }) }, { l: 'Marcar entregado', i: 'check', show: r => r.estado === 'pendiente' || r.estado === 'en ruta', fn: r => DB.update('repartos', r.id, { estado: 'entregado' }) }] }) };
