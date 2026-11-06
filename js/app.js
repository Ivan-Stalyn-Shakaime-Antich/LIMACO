'use strict';
const ORDER = ['dashboard', 'usuarios', 'trabajadores', 'clientes', 'productos', 'proveedores', 'compras', 'ventas', 'inventario', 'reportes', 'repartos', 'finanzas', 'configuracion'];
let CUR = null;
function applyTheme(t) { document.documentElement.dataset.theme = t; $('#themeBtn').innerHTML = `<i class="fa-solid fa-${t === 'dark' ? 'sun' : 'moon'}"></i>`; }
async function go(key) {
  const m = MOD[key]; if (!m || !m.roles.includes(ME.rol)) return;
  CUR = key; $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.k === key)); $('#pageTitle').textContent = m.t; sessionStorage.setItem('sge:mod', key);
  $('#side').classList.remove('open'); $('#scrim').classList.remove('open');
  const v = $('#view'); v.onclick = v.onchange = v.oninput = null; v.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Cargando…</div>';
  try { await m.run(v); } catch (e) { console.error(e); v.innerHTML = errBox(e); }
  window.scrollTo(0, 0);
}
function enter(me) {
  if (!me.activo) return showAuth('pending');
  ME = me; $('#auth').hidden = true; $('#shell').hidden = false; $('#demoTag').hidden = DB.mode !== 'demo';
  $('#userChip').innerHTML = `<b>${esc(me.nombre || me.usuario)}</b><small>${esc(me.rol)}</small>`;
  const ok = ORDER.filter(k => MOD[k].roles.includes(me.rol));
  $('#nav').innerHTML = ok.map(k => `<button data-k="${k}"><i class="fa-solid fa-${MOD[k].i}"></i> ${MOD[k].t}</button>`).join('');
  const last = sessionStorage.getItem('sge:mod'); go(ok.includes(last) ? last : ok[0]);
}
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem('sge:theme') || 'light');
  $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('sge:theme', t); applyTheme(t); };
  $('#nav').onclick = e => { const b = e.target.closest('[data-k]'); if (b) go(b.dataset.k); };
  $('#menuBtn').onclick = () => { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('open'); };
  $('#scrim').onclick = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('open'); };
  $('#logoutBtn').onclick = async () => { await DB.auth.signOut(); ME = null; sessionStorage.removeItem('sge:mod'); showAuth('login'); };
  try {
    await DB.init(); window.addEventListener('sge-recovery', () => showAuth('newpass'));
    const me = await DB.auth.session(); if (me) enter(me); else showAuth('login');
  } catch (e) { console.error(e); $('#auth').innerHTML = `<div class="a-form" style="grid-column:1/-1"><div class="a-card"><h3>No se pudo iniciar</h3><div class="msg bad">${esc(e.message)}</div><p class="muted" style="margin-top:10px">Revisa js/config.js y tu conexión.</p></div></div>`; }
});
