# Sistema de Gestión Empresarial (GitHub Pages + Supabase)

Sistema con **inicio de sesión**, base de datos **SQL gratuita (PostgreSQL de Supabase)** y módulos: Dashboard, Usuarios, Trabajadores (lista, asistencias, pagos y descuentos, historial), Clientes, Catálogo de productos, Proveedores, Compras, Ventas, Inventario, Reportes, Repartos, Finanzas (resumen, caja, estadística, gastos, historial) y Configuración.

> **Por qué Supabase:** GitHub Pages solo aloja archivos estáticos; no puede guardar datos ni validar contraseñas. Supabase ofrece gratis la base de datos, el login y la recuperación por correo, y se conecta desde el navegador con una clave **pública** (`anon`) protegida por reglas de seguridad (RLS) ya incluidas en `supabase/schema.sql`.

## Probar sin configurar nada (MODO DEMO)
1. Sirve la carpeta (`python -m http.server 8000` o Live Server) y abre `http://localhost:8000`.
2. Con `js/config.js` vacío entra en **modo demo**: los datos viven solo en tu navegador. No es seguro ni compartible. Sirve para conocer el sistema.

## Puesta en marcha real (≈15 minutos, gratis)
1. Crea cuenta en **supabase.com** → *New project* (guarda la contraseña de la base de datos).
2. *SQL Editor → New query*: pega todo `supabase/schema.sql` → **Run**.
3. *Project Settings → API*: copia **Project URL** y **anon public key** en `js/config.js`. (Nunca uses `service_role`.)
4. *Authentication → URL Configuration*: en **Site URL** pon la URL final de tu sitio (`https://USUARIO.github.io/REPOSITORIO/`) y agrégala en **Redirect URLs**. Sin esto, el enlace de recuperar contraseña no vuelve a tu sistema.
5. Sube la carpeta a un repositorio de GitHub → *Settings → Pages → Deploy from branch → main / root*.
6. **Crea tu cuenta de administrador inmediatamente**: abre el sitio, pulsa *Crear cuenta*. **El primer usuario registrado es el administrador general** (confirma tu correo si Supabase lo pide). Hazlo antes de compartir el enlace.
7. Los demás usuarios se registran y quedan **pendientes**; tú los activas y asignas rol en *Usuarios*. Si no quieres registros abiertos: *Authentication → Providers → Email → desactivar "Allow new users to sign up"* y crea usuarios en *Authentication → Users → Add user* (luego actívalos en *Usuarios*).

## Usuario y contraseña
No incluyo credenciales predeterminadas: el repositorio es público y cualquiera podría usarlas. **Tú creas tu usuario y contraseña** en el paso 6.

## Recuperación de acceso
- **Contraseña:** "¿Olvidaste tu usuario o contraseña?" → ingresas tu correo → Supabase envía el enlace → defines la nueva contraseña.
- **Usuario:** ingresas tu correo, teléfono o usuario y el sistema muestra una **pista enmascarada** (p. ej. `ad***in`, `ad***@gmail.com`).
- **Por teléfono (SMS):** enviar SMS requiere un proveedor de pago (Twilio, etc.). El teléfono se guarda y sirve para localizar tu cuenta y mostrar la pista, pero el restablecimiento se hace por correo.
- El correo gratuito de Supabase tiene límite de envíos por hora; para volumen alto configura un SMTP propio.

## Roles
- **admin:** todo (incluye Usuarios y Configuración).
- **gerente:** todo excepto Usuarios y Configuración.
- **vendedor:** Dashboard, Clientes, Productos, Ventas, Inventario y Repartos. No ve Finanzas ni Trabajadores (aplicado también en la base de datos con RLS).

## Cómo funciona la lógica
Ventas, compras, ajustes e inventario actualizan stock, movimientos y caja desde la aplicación (varias operaciones consecutivas, no una transacción única). Para un negocio pequeño es suficiente; si necesitas atomicidad estricta, conviértelas en funciones SQL.

## Limitaciones conocidas
- No probé el sistema contra un proyecto Supabase real (sin conexión en mi entorno); el modo demo sí fue probado de punta a punta. Si algo falla al conectar, revisa la consola del navegador y que el SQL se haya ejecutado completo.
- Las credenciales del modo demo no son seguras (hash simple en el navegador).
- Anular una venta/compra revierte stock y caja, pero editar manualmente registros relacionados puede desajustarlos.
- Respalda tus datos: *Configuración → Respaldo* descarga todo en JSON.
