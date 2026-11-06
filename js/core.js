'use strict';
let ME = null; const MOD = {};
async function log(accion, tabla, detalle) { try { await DB.insert('bitacora', { fecha: new Date().toISOString(), usuario: ME ? ME.usuario : '', accion, tabla, detalle }); } catch (e) { /* sin permiso o sin conexión */ } }
async function getCfg() { try { return (await DB.list('configuracion'))[0] || {}; } catch (e) { return {}; } }
function tabs(box, list, init = 0) {
  box.innerHTML = `<div class="tabs" role="tablist">${list.map((x, i) => `<button role="tab" data-t="${i}">${x.t}</button>`).join('')}</div><div id="tabBody"></div>`;
  const go = async i => { $$('.tabs button', box).forEach((b, j) => b.classList.toggle('on', i === j)); const el = $('#tabBody', box); el.onclick = el.onchange = el.oninput = null; el.innerHTML = '<div class="loading">Cargando…</div>'; try { await list[i].fn(el); } catch (e) { console.error(e); el.innerHTML = errBox(e); } };
  $('.tabs', box).onclick = e => { const b = e.target.closest('[data-t]'); if (b) go(+b.dataset.t); }; go(init);
}
const ESTADOS = { asistio: 'ok', tardanza: 'warn', falta: 'bad', permiso: 'info', pendiente: 'warn', 'en ruta': 'info', entregado: 'ok', cancelado: 'bad', activo: 'ok', inactivo: 'bad', ingreso: 'ok', egreso: 'bad', completada: 'ok', anulada: 'bad' };
/* Campos: [clave, etiqueta, tipo, requerido, opciones | 'c' = solo al crear] */
const ENT = {
  perfiles: { cols: ['usuario', 'nombre', 'correo', 'telefono', 'rol', 'activo'], f: [['rol', 'Rol', 'select', 1, ['admin', 'gerente', 'vendedor']], ['activo', 'Cuenta activa', 'check']] },
  clientes: { cols: ['nombre', 'documento', 'telefono', 'correo', 'direccion'], f: [['nombre', 'Nombre / Razón social', 'text', 1], ['documento', 'DNI / RUC', 'text'], ['telefono', 'Teléfono', 'tel'], ['correo', 'Correo', 'email'], ['direccion', 'Dirección', 'text'], ['notas', 'Notas', 'textarea']] },
  proveedores: { cols: ['empresa', 'ruc', 'contacto', 'telefono', 'correo'], f: [['empresa', 'Empresa', 'text', 1], ['ruc', 'RUC', 'text'], ['contacto', 'Persona de contacto', 'text'], ['telefono', 'Teléfono', 'tel'], ['correo', 'Correo', 'email'], ['direccion', 'Dirección', 'text'], ['notas', 'Notas', 'textarea']] },
  productos: { cols: ['codigo', 'nombre', 'categoria', 'precio_compra', 'precio_venta', 'stock', 'activo'], f: [['codigo', 'Código', 'text'], ['nombre', 'Nombre del producto', 'text', 1], ['categoria', 'Categoría', 'text'], ['unidad', 'Unidad', 'select', 1, ['unid', 'kg', 'lt', 'caja', 'paquete', 'docena']], ['precio_compra', 'Precio de compra', 'money', 1], ['precio_venta', 'Precio de venta', 'money', 1], ['stock', 'Stock inicial', 'number', 1, 'c'], ['stock_minimo', 'Stock mínimo', 'number', 1], ['activo', 'Activo (a la venta)', 'check']] },
  trabajadores: { badge: { estado: ESTADOS }, cols: ['nombre', 'documento', 'cargo', 'telefono', 'sueldo', 'fecha_ingreso', 'estado'], f: [['nombre', 'Nombre completo', 'text', 1], ['documento', 'DNI', 'text'], ['cargo', 'Cargo', 'text'], ['telefono', 'Teléfono', 'tel'], ['correo', 'Correo', 'email'], ['sueldo', 'Sueldo mensual', 'money', 1], ['fecha_ingreso', 'Fecha de ingreso', 'date'], ['estado', 'Estado', 'select', 1, ['activo', 'inactivo']]] },
  asistencias: { badge: { estado: ESTADOS }, cols: ['fecha', 'trabajador_id', 'estado', 'horas', 'nota'], f: [['trabajador_id', 'Trabajador', 'ref:trabajadores:nombre', 1], ['fecha', 'Fecha', 'date', 1], ['estado', 'Estado', 'select', 1, ['asistio', 'tardanza', 'falta', 'permiso']], ['horas', 'Horas trabajadas', 'number'], ['nota', 'Nota', 'text']] },
  pagos_trabajadores: { cols: ['fecha', 'trabajador_id', 'tipo', 'concepto', 'monto'], f: [['trabajador_id', 'Trabajador', 'ref:trabajadores:nombre', 1], ['fecha', 'Fecha', 'date', 1], ['tipo', 'Tipo', 'select', 1, ['pago', 'adelanto', 'bonificacion', 'descuento']], ['concepto', 'Concepto', 'text'], ['monto', 'Monto', 'money', 1]] },
  repartos: { badge: { estado: ESTADOS }, cols: ['fecha', 'venta_id', 'cliente_id', 'direccion', 'repartidor_id', 'estado'], f: [['venta_id', 'Venta (opcional)', 'ref:ventas:id'], ['cliente_id', 'Cliente', 'ref:clientes:nombre'], ['direccion', 'Dirección de entrega', 'text', 1], ['repartidor_id', 'Repartidor', 'ref:trabajadores:nombre'], ['fecha', 'Fecha', 'date', 1], ['estado', 'Estado', 'select', 1, ['pendiente', 'en ruta', 'entregado', 'cancelado']], ['nota', 'Nota', 'text']] },
  gastos: { cols: ['fecha', 'categoria', 'descripcion', 'monto', 'metodo'], f: [['fecha', 'Fecha', 'date', 1], ['categoria', 'Categoría', 'select', 1, ['Alquiler', 'Servicios', 'Sueldos', 'Transporte', 'Marketing', 'Mantenimiento', 'Impuestos', 'Otros']], ['descripcion', 'Descripción', 'text', 1], ['monto', 'Monto', 'money', 1], ['metodo', 'Método', 'select', 1, ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta']]] },
  caja: { badge: { tipo: ESTADOS }, cols: ['fecha', 'tipo', 'concepto', 'monto', 'metodo', 'ref'], f: [['fecha', 'Fecha', 'date', 1], ['tipo', 'Tipo', 'select', 1, ['ingreso', 'egreso']], ['concepto', 'Concepto', 'text', 1], ['monto', 'Monto', 'money', 1], ['metodo', 'Método', 'select', 1, ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta']]] }
};
const HEAD = { trabajador_id: 'Trabajador', venta_id: 'Venta', cliente_id: 'Cliente', repartidor_id: 'Repartidor', precio_compra: 'P. compra', precio_venta: 'P. venta', fecha_ingreso: 'Ingreso', ref: 'Referencia', stock_minimo: 'Stock mín.' };
const hname = k => HEAD[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));

async function crud(key, box, opt = {}) {
  const E = ENT[key], refs = {};
  for (const f of E.f) if (String(f[2]).startsWith('ref:')) { const [, t, lb] = f[2].split(':'); refs[f[0]] = { lb, rows: await DB.list(t) }; }
  let rows = await DB.list(key, opt.list); if (opt.filter) rows = rows.filter(opt.filter);
  const F = k => E.f.find(f => f[0] === k), rn = (k, id) => { const r = refs[k].rows.find(x => x.id == id); return r ? (k === 'venta_id' ? '#' : '') + r[refs[k].lb] : ''; };
  const cell = (r, k) => {
    const f = F(k), v = r[k]; if (!f) return esc(v ?? ''); const t = f[2];
    if (t === 'money') return money(v); if (t === 'check') return v ? '<span class="badge ok">Sí</span>' : '<span class="badge">No</span>';
    if (t.startsWith('ref:')) return esc(rn(k, v)); if (t === 'date') return fdate(v);
    if (E.badge && E.badge[k]) return `<span class="badge ${E.badge[k][v] || ''}">${esc(v)}</span>`; return esc(v ?? '');
  };
  const canDel = opt.canDelete ?? (ME.rol !== 'vendedor'), extra = opt.extra || [];
  box.innerHTML = `<div class="card"><div class="bar2"><input class="in" id="cq" placeholder="Buscar…" aria-label="Buscar">${opt.bar || ''}<span class="sp"></span>${opt.canAdd === false ? '' : `<button class="btn pri" id="cadd"><i class="fa-solid fa-plus"></i> Nuevo</button>`}<button class="btn" id="ccsv"><i class="fa-solid fa-file-csv"></i> CSV</button></div><div class="tw" id="ct"></div></div>`;
  const view = () => { const q = norm($('#cq', box).value); return rows.filter(r => !q || norm(E.cols.map(k => F(k) ? (F(k)[2].startsWith('ref:') ? rn(k, r[k]) : r[k]) : r[k]).join(' ')).includes(q)); };
  const draw = () => {
    const l = view();
    $('#ct', box).innerHTML = table([...E.cols.map(hname), ''], l.map(r => [...E.cols.map(k => `<td>${cell(r, k)}</td>`), `<td class="act">${extra.filter(x => !x.show || x.show(r)).map(x => `<button class="btn sm" data-x="${extra.indexOf(x)}:${r.id}" title="${x.l}"><i class="fa-solid fa-${x.i}"></i></button>`).join('')}${opt.canEdit === false ? '' : `<button class="btn sm" data-e="${r.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>`}${canDel ? `<button class="btn sm bad" data-d="${r.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}</td>`]), 'Sin registros todavía.');
  };
  const reload = () => crud(key, box, opt);
  const input = (f, v) => {
    const [k, l, t, r, o] = f, id = 'f_' + k, lab = `<label for="${id}">${l}${r ? ' *' : ''}</label>`;
    if (t === 'textarea') return `<div class="full">${lab}<textarea class="in" id="${id}" rows="2">${esc(v ?? '')}</textarea></div>`;
    if (t === 'check') return `<div><label class="lb"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${l}</label></div>`;
    if (t === 'select') return `<div>${lab}<select class="in" id="${id}">${o.map(x => `<option ${x == v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
    if (t.startsWith('ref:')) return `<div>${lab}<select class="in" id="${id}"><option value="">—</option>${refs[k].rows.map(x => `<option value="${x.id}" ${x.id == v ? 'selected' : ''}>${esc((k === 'venta_id' ? '#' : '') + x[refs[k].lb])}</option>`).join('')}</select></div>`;
    const ty = t === 'money' || t === 'number' ? 'number' : t; return `<div>${lab}<input class="in" id="${id}" type="${ty}" ${ty === 'number' ? 'step="any" min="0"' : ''} value="${esc(v ?? '')}"></div>`;
  };
  const openForm = old => {
    const isNew = !old, fields = E.f.filter(f => !(f[4] === 'c' && !isNew)); const d = old || { fecha: today(), activo: true, estado: undefined, ...(opt.defaults || {}) };
    const b = modal((isNew ? 'Nuevo' : 'Editar') + ' registro', `<form id="cf" class="fg">${fields.map(f => input(f, d[f[0]] ?? (f[2] === 'money' || f[2] === 'number' ? (f[3] ? 0 : '') : ''))).join('')}<div class="full right"><button class="btn" type="button" id="cc">Cancelar</button> <button class="btn pri" id="cs">Guardar</button></div></form>`);
    $('#cc', b).onclick = closeModal;
    $('#cf', b).onsubmit = async e => {
      e.preventDefault(); const btn = $('#cs', b); btn.disabled = true;
      try {
        const o = {};
        for (const f of fields) { const [k, , t, r] = f, el = $('#f_' + k, b); let v; if (t === 'check') v = el.checked; else { v = el.value.trim(); if (t === 'money' || t === 'number') v = v === '' ? (r ? NaN : null) : +v; else if (t.startsWith('ref:')) v = v === '' ? null : +v; else if (v === '') v = null; } if (r && (v === null || Number.isNaN(v))) throw new Error('Completa el campo: ' + f[1]); if (typeof v === 'number' && v < 0) throw new Error('No se permiten valores negativos: ' + f[1]); o[k] = v; }
        if (opt.before) await opt.before(o, isNew, old);
        const saved = isNew ? await DB.insert(key, o) : await DB.update(key, old.id, o);
        if (opt.after) await opt.after(saved, isNew, old);
        log(isNew ? 'crear' : 'editar', key, '#' + saved.id); closeModal(); toast('Guardado correctamente'); reload();
      } catch (er) { toast(cleanErr(er), true); btn.disabled = false; }
    };
  };
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.id === 'cadd') openForm(null);
      else if (b.id === 'ccsv') downloadCSV(key, E.cols.map(k => ({ l: hname(k), v: r => F(k) && F(k)[2].startsWith('ref:') ? rn(k, r[k]) : r[k] })), view());
      else if (b.dataset.e) openForm(rows.find(r => r.id == b.dataset.e));
      else if (b.dataset.d) { const r = rows.find(x => x.id == b.dataset.d); if (confirm('¿Eliminar este registro?')) { await DB.remove(key, r.id); if (opt.afterDelete) await opt.afterDelete(r); log('eliminar', key, '#' + r.id); toast('Eliminado'); reload(); } }
      else if (b.dataset.x) { const [i, id] = b.dataset.x.split(':'); await extra[+i].fn(rows.find(r => r.id == id)); reload(); }
    } catch (er) { toast(cleanErr(er) + (b.dataset.d ? ' (si tiene movimientos, desactívalo en lugar de eliminarlo)' : ''), true); }
  };
  $('#cq', box).oninput = draw; draw();
}
