'use strict';
function showAuth(mode, ctx = {}) {
  const A = $('#auth'); $('#shell').hidden = true; A.hidden = false;
  const brand = `<div class="a-brand"><i class="fa-solid fa-store"></i><h2>Sistema de Gestión Empresarial</h2><p>Ventas, compras, inventario, trabajadores, repartos y finanzas en un solo lugar.</p>${DB.mode === 'demo' ? '<p class="msg">MODO DEMO: los datos se guardan solo en este navegador.</p>' : ''}</div>`;
  const wrap = h => { A.innerHTML = brand + `<div class="a-form"><div class="a-card">${h}</div></div>`; };
  const say = (m, c = '') => { const el = $('#aMsg'); if (el) el.innerHTML = m ? `<div class="msg ${c}">${m}</div>` : ''; };
  const run = fn => async e => { e.preventDefault(); const b = e.target.querySelector('button.pri'); b.disabled = true; say(''); try { await fn(e.target); } catch (er) { say(esc(cleanErr(er)), 'bad'); } b.disabled = false; };
  const link = (id, mo) => { const el = $('#' + id); if (el) el.onclick = () => showAuth(mo); };
  if (mode === 'login') {
    wrap(`<h3>Iniciar sesión</h3><p class="muted">Ingresa con tu usuario o correo.</p><form id="f"><div><label class="lb" for="u">Usuario o correo</label><input class="in" id="u" autocomplete="username" required></div><div><label class="lb" for="p">Contraseña</label><input class="in" id="p" type="password" autocomplete="current-password" required></div><button class="btn pri" style="justify-content:center">Ingresar</button></form><div id="aMsg"></div><div class="a-links"><a id="l1">¿Olvidaste tu usuario o contraseña?</a><a id="l2">Crear cuenta</a></div>`);
    link('l1', 'forgot'); link('l2', 'register');
    $('#f').onsubmit = run(async () => enter(await DB.auth.signIn($('#u').value, $('#p').value)));
  } else if (mode === 'register') {
    DB.auth.bootstrap().then(first => {
      wrap(`<h3>${first ? 'Crear cuenta de administrador general' : 'Solicitar acceso'}</h3><p class="muted">${first ? 'Eres el primer usuario: tendrás control total del sistema.' : 'El administrador deberá aprobar tu cuenta.'}</p><form id="f"><div><label class="lb" for="n">Nombre completo</label><input class="in" id="n" required></div><div class="fg"><div><label class="lb" for="u">Usuario</label><input class="in" id="u" pattern="[A-Za-z0-9_.\\-]{3,20}" title="3 a 20 letras, números, punto o guion" required></div><div><label class="lb" for="t">Teléfono</label><input class="in" id="t" type="tel" required></div></div><div><label class="lb" for="c">Correo electrónico</label><input class="in" id="c" type="email" required></div><div class="fg"><div><label class="lb" for="p">Contraseña (mín. 8)</label><input class="in" id="p" type="password" minlength="8" autocomplete="new-password" required></div><div><label class="lb" for="p2">Repetir contraseña</label><input class="in" id="p2" type="password" minlength="8" autocomplete="new-password" required></div></div><button class="btn pri" style="justify-content:center">${first ? 'Crear cuenta de administrador' : 'Enviar solicitud'}</button></form><div id="aMsg"></div><div class="a-links"><a id="l1">← Volver a iniciar sesión</a></div>`);
      link('l1', 'login');
      $('#f').onsubmit = run(async () => {
        if ($('#p').value !== $('#p2').value) throw new Error('Las contraseñas no coinciden.');
        const r = await DB.auth.signUp({ nombre: $('#n').value.trim(), usuario: $('#u').value, telefono: $('#t').value.trim(), correo: $('#c').value, password: $('#p').value });
        if (r.profile && r.profile.activo) return enter(r.profile);
        say(r.confirm ? 'Cuenta creada. Revisa tu correo y confirma tu dirección para continuar.' : 'Solicitud enviada. Un administrador debe activar tu cuenta.', 'ok');
      });
    });
  } else if (mode === 'forgot') {
    wrap(`<h3>Recuperar acceso</h3><p class="muted"><b>Contraseña:</b> te enviamos un enlace al correo.</p><form id="f"><input class="in" id="c" type="email" placeholder="Tu correo registrado" required><button class="btn pri" style="justify-content:center">Enviar enlace de recuperación</button></form><div id="aMsg"></div><hr style="margin:18px 0;border:0;border-top:1px solid var(--line)"><p class="muted"><b>Usuario olvidado:</b> escribe tu correo o teléfono y te mostramos una pista.</p><form id="f2"><input class="in" id="q" placeholder="Correo, teléfono o usuario" required><button class="btn pri" style="justify-content:center">Ver pista</button></form><div id="aMsg2"></div><p class="muted" style="font-size:.8rem;margin-top:10px">El envío de SMS requiere un proveedor de pago; por eso el restablecimiento se realiza por correo.</p><div class="a-links"><a id="l1">← Volver</a></div>`);
    link('l1', 'login');
    $('#f').onsubmit = run(async () => { const email = $('#c').value, r = await DB.auth.reset(email); if (r.demoCode) return showAuth('democode', { email, code: r.demoCode }); say('Si el correo está registrado, recibirás un enlace para crear una nueva contraseña. Revisa también el spam.', 'ok'); });
    $('#f2').onsubmit = async e => { e.preventDefault(); const r = await DB.auth.hint($('#q').value); $('#aMsg2').innerHTML = r ? `<div class="msg ok">Tu usuario: <b>${esc(r.usuario)}</b><br>Tu correo: <b>${esc(r.correo)}</b></div>` : '<div class="msg bad">No encontramos una cuenta con esos datos.</div>'; };
  } else if (mode === 'democode') {
    wrap(`<h3>Código de recuperación</h3><div class="msg">MODO DEMO: en un sistema real este código llega a tu correo. Tu código es <b>${esc(ctx.code)}</b></div><form id="f"><input class="in" id="k" placeholder="Código de 6 dígitos" required><input class="in" id="p" type="password" minlength="8" placeholder="Nueva contraseña (mín. 8)" required><button class="btn pri" style="justify-content:center">Cambiar contraseña</button></form><div id="aMsg"></div>`);
    $('#f').onsubmit = run(async () => { await DB.auth.confirmReset(ctx.email, $('#k').value.trim(), $('#p').value); showAuth('login'); toast('Contraseña actualizada. Ya puedes ingresar.'); });
  } else if (mode === 'newpass') {
    wrap(`<h3>Crea tu nueva contraseña</h3><form id="f"><input class="in" id="p" type="password" minlength="8" placeholder="Nueva contraseña (mín. 8)" autocomplete="new-password" required><input class="in" id="p2" type="password" minlength="8" placeholder="Repetir contraseña" autocomplete="new-password" required><button class="btn pri" style="justify-content:center">Guardar contraseña</button></form><div id="aMsg"></div>`);
    $('#f').onsubmit = run(async () => { if ($('#p').value !== $('#p2').value) throw new Error('Las contraseñas no coinciden.'); await DB.auth.updatePassword($('#p').value); await DB.auth.signOut(); history.replaceState(null, '', location.pathname); showAuth('login'); toast('Contraseña actualizada. Ingresa con la nueva.'); });
  } else if (mode === 'pending') {
    wrap(`<h3>Cuenta pendiente</h3><div class="msg">Tu cuenta aún no fue activada por el administrador. Vuelve a intentarlo más tarde.</div><p style="margin-top:14px"><button class="btn" id="lo">Salir</button></p>`);
    $('#lo').onclick = async () => { await DB.auth.signOut(); showAuth('login'); };
  }
}
