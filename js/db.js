'use strict';
const mask = (s, k) => !s ? '' : k === 'mail' ? s.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2') : s.replace(/^(.{2}).*(.)$/, '$1***$2');
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sge|' + t)))].map(b => b.toString(16).padStart(2, '0')).join('');
const cleanErr = e => { const m = String((e && e.message) || e); return /Invalid login/i.test(m) ? 'Usuario o contraseña incorrectos.' : /already registered|already been registered/i.test(m) ? 'Ese correo ya está registrado.' : /duplicate key|perfiles_usuario/i.test(m) ? 'Ese nombre de usuario ya existe.' : /row-level security|permission denied/i.test(m) ? 'No tienes permiso para esta acción.' : /Email not confirmed/i.test(m) ? 'Confirma tu correo antes de ingresar (revisa tu bandeja).' : /rate limit/i.test(m) ? 'Demasiados intentos. Espera unos minutos.' : m; };

/* ---------- Adaptador DEMO (localStorage) ---------- */
const DemoDB = {
  mode: 'demo',
  load() { this.d = JSON.parse(localStorage.getItem('sge:demo') || 'null') || { t: {}, seq: {}, users: [], session: null, codes: {} }; },
  save() { localStorage.setItem('sge:demo', JSON.stringify(this.d)); },
  async init() { this.load(); },
  pub(u) { const { hash, ...r } = u; return r; },
  async list(t, o = {}) {
    let a = t === 'perfiles' ? this.d.users.map(u => this.pub(u)) : (this.d.t[t] || []).map(x => ({ ...x }));
    const k = o.order || 'id'; a.sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * (o.asc ? 1 : -1)); return a;
  },
  async insert(t, row) {
    const rows = Array.isArray(row) ? row : [row];
    const out = rows.map(r => { const id = r.id ?? (this.d.seq[t] = (this.d.seq[t] || 0) + 1); if (r.id) this.d.seq[t] = Math.max(this.d.seq[t] || 0, r.id); const x = { creado: new Date().toISOString(), ...r, id }; (this.d.t[t] = this.d.t[t] || []).push(x); return { ...x }; });
    this.save(); return Array.isArray(row) ? out : out[0];
  },
  async update(t, id, p) {
    const arr = t === 'perfiles' ? this.d.users : (this.d.t[t] || []); const x = arr.find(r => r.id == id); if (!x) throw new Error('Registro no encontrado'); Object.assign(x, p); this.save(); return { ...x };
  },
  async remove(t, id) { this.d.t[t] = (this.d.t[t] || []).filter(r => r.id != id); this.save(); },
  async exportAll() { return JSON.parse(JSON.stringify({ ...this.d.t, perfiles: this.d.users.map(u => this.pub(u)) })); },
  async importAll(o) { Object.keys(o).forEach(k => { if (k !== 'perfiles') this.d.t[k] = o[k]; }); Object.keys(this.d.t).forEach(k => { this.d.seq[k] = Math.max(0, ...this.d.t[k].map(r => +r.id || 0)); }); this.save(); },
  auth: {
    async session() { const u = DemoDB.d.users.find(x => x.id === DemoDB.d.session); return u ? DemoDB.pub(u) : null; },
    async signIn(id, pw) {
      const q = id.trim().toLowerCase(), u = DemoDB.d.users.find(x => x.usuario === q || (x.correo || '').toLowerCase() === q);
      if (!u || u.hash !== await sha(pw)) throw new Error('Usuario o contraseña incorrectos.');
      DemoDB.d.session = u.id; DemoDB.save(); return DemoDB.pub(u);
    },
    async signUp(f) {
      const us = f.usuario.trim().toLowerCase(), em = f.correo.trim().toLowerCase();
      if (DemoDB.d.users.some(x => x.usuario === us)) throw new Error('Ese nombre de usuario ya existe.');
      if (DemoDB.d.users.some(x => (x.correo || '').toLowerCase() === em)) throw new Error('Ese correo ya está registrado.');
      const first = DemoDB.d.users.length === 0;
      const u = { id: 'u' + Date.now(), usuario: us, nombre: f.nombre, correo: em, telefono: f.telefono, rol: first ? 'admin' : 'vendedor', activo: first, creado: new Date().toISOString(), hash: await sha(f.password) };
      DemoDB.d.users.push(u); if (first) DemoDB.d.session = u.id; DemoDB.save(); return { profile: first ? DemoDB.pub(u) : null, confirm: false };
    },
    async signOut() { DemoDB.d.session = null; DemoDB.save(); },
    async reset(email) { const u = DemoDB.d.users.find(x => (x.correo || '').toLowerCase() === email.trim().toLowerCase()); if (!u) return {}; const c = String(Math.floor(100000 + Math.random() * 900000)); DemoDB.d.codes[u.correo] = c; DemoDB.save(); return { demoCode: c }; },
    async confirmReset(email, code, pw) { const e = email.trim().toLowerCase(), u = DemoDB.d.users.find(x => (x.correo || '').toLowerCase() === e); if (!u || DemoDB.d.codes[u.correo] !== code) throw new Error('Código incorrecto.'); u.hash = await sha(pw); delete DemoDB.d.codes[u.correo]; DemoDB.save(); },
    async updatePassword(pw) { const u = DemoDB.d.users.find(x => x.id === DemoDB.d.session); u.hash = await sha(pw); DemoDB.save(); },
    async hint(q) { const s = q.trim().toLowerCase(), u = DemoDB.d.users.find(x => x.usuario === s || (x.correo || '').toLowerCase() === s || x.telefono === q.trim()); return u ? { usuario: mask(u.usuario), correo: mask(u.correo, 'mail') } : null; },
    async bootstrap() { return DemoDB.d.users.length === 0; }
  }
};

/* ---------- Adaptador SUPABASE (PostgreSQL) ---------- */
const SbDB = {
  mode: 'supabase',
  async init() {
    this.c = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    this.c.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') window.dispatchEvent(new Event('sge-recovery')); });
  },
  async list(t, o = {}) { const { data, error } = await this.c.from(t).select('*').order(o.order || 'id', { ascending: !!o.asc }).range(0, 9999); if (error) throw error; return data; },
  async insert(t, row) { const { data, error } = await this.c.from(t).insert(row).select(); if (error) throw error; return Array.isArray(row) ? data : data[0]; },
  async update(t, id, p) { const { data, error } = await this.c.from(t).update(p).eq('id', id).select(); if (error) throw error; return data[0]; },
  async remove(t, id) { const { error } = await this.c.from(t).delete().eq('id', id); if (error) throw error; },
  async exportAll() { const o = {}; for (const t of ['perfiles', 'clientes', 'proveedores', 'productos', 'trabajadores', 'asistencias', 'pagos_trabajadores', 'compras', 'compra_items', 'ventas', 'venta_items', 'movimientos_inventario', 'repartos', 'gastos', 'caja', 'configuracion', 'bitacora']) { try { o[t] = await this.list(t); } catch (e) { o[t] = []; } } return o; },
  async importAll() { throw new Error('La importación solo está disponible en modo demo. Usa el panel de Supabase para restaurar.'); },
  auth: {
    async profile(uid) { const { data } = await SbDB.c.from('perfiles').select('*').eq('id', uid).maybeSingle(); return data; },
    async session() { const { data } = await SbDB.c.auth.getSession(); return data.session ? await this.profile(data.session.user.id) : null; },
    async signIn(id, pw) {
      let email = id.trim();
      if (!email.includes('@')) { const { data } = await SbDB.c.rpc('email_for_username', { u: email }); if (!data) throw new Error('Usuario o contraseña incorrectos.'); email = data; }
      const { data, error } = await SbDB.c.auth.signInWithPassword({ email, password: pw }); if (error) throw new Error(cleanErr(error));
      const p = await this.profile(data.user.id); if (!p) throw new Error('Tu perfil no existe. Ejecuta el SQL de supabase/schema.sql.'); return p;
    },
    async signUp(f) {
      const { data, error } = await SbDB.c.auth.signUp({ email: f.correo.trim(), password: f.password, options: { data: { usuario: f.usuario.trim().toLowerCase(), nombre: f.nombre, telefono: f.telefono }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(cleanErr(error));
      if (data.session) return { profile: await this.profile(data.user.id), confirm: false };
      return { profile: null, confirm: true };
    },
    async signOut() { await SbDB.c.auth.signOut(); },
    async reset(email) { const { error } = await SbDB.c.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname }); if (error) throw new Error(cleanErr(error)); return {}; },
    async updatePassword(pw) { const { error } = await SbDB.c.auth.updateUser({ password: pw }); if (error) throw new Error(cleanErr(error)); },
    async hint(q) { const { data } = await SbDB.c.rpc('recovery_hint', { q: q.trim() }); return data || null; },
    async bootstrap() { const { data } = await SbDB.c.rpc('bootstrap_needed'); return !!data; }
  }
};
const USE_SB = !!(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY && window.supabase);
const DB = USE_SB ? SbDB : DemoDB;
