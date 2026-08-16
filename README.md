# El Recetario 🥄

Blog de recetas (comida y dulces) hecho con HTML, CSS y JavaScript puro. Sin frameworks, sin servicios de pago.

## Archivos
- `index.html` — estructura de la página
- `style.css` — todos los estilos (colores, tipografía, diseño)
- `script.js` — toda la lógica (guardar recetas, filtros, subir fotos/video, contacto)

## Cómo abrirlo en Visual Studio Code
1. Descarga los 3 archivos (más este README) en una misma carpeta, por ejemplo `recetario/`.
2. Abre esa carpeta en VS Code: **Archivo → Abrir carpeta…**
3. Instala la extensión gratuita **Live Server** (de Ritwick Dey) desde la pestaña de extensiones.
4. Haz clic derecho sobre `index.html` → **Open with Live Server**.
5. Se abrirá en tu navegador en una dirección tipo `http://127.0.0.1:5500`.

También puedes abrir `index.html` directamente con doble clic desde el explorador de archivos, aunque con Live Server las recargas automáticas al editar el código funcionan mejor.

## Qué incluye
- **Inicio**: sección de bienvenida con un "corcho" decorativo de recetas.
- **Recetas**: galería con filtro por *Todas / Comida / Dulces* y buscador por nombre o ingrediente. Al hacer clic en una tarjeta se abre el detalle completo (foto, ingredientes, pasos y video).
- **Compartir**: formulario para publicar una receta nueva con nombre, categoría, ingredientes, pasos, varias fotos y un video (dos formas: subir archivo o pegar enlace de YouTube).
- **Contacto**: formulario que abre el correo del visitante con el mensaje ya redactado (`mailto:`), y el correo de contacto visible directamente.

## Usuario administrador
Hay un correo especial con permisos de **administrador**: puede editar y eliminar **cualquier** receta, no solo las suyas (verás los botones ✏️ y 🗑 en todas las tarjetas, marcados como "(admin)" en el detalle).

Para activarlo:
1. Abre `script.js` y busca la constante `ADMIN_EMAILS` cerca del inicio del archivo.
2. Cambia `"admin@elrecetario.com"` por tu propio correo (el mismo con el que vas a registrarte en la web). Puedes agregar más de uno separados por coma: `["tucorreo@gmail.com", "otroadmin@correo.com"]`.
3. Regístrate en la web con ese correo — automáticamente tendrás permisos de administrador.

⚠️ Recuerda que este sistema de cuentas es solo del navegador (ver nota de seguridad más abajo), así que "administrador" aquí significa "correo con permisos especiales dentro de esta app", no una cuenta protegida por un servidor real.

## Inicio de sesión y publicación
Para compartir una receta ahora hay que **registrarse** (nombre, correo y contraseña) e **iniciar sesión**. Cada receta queda asociada al correo de quien la publicó, y solo esa persona ve los botones ✏️ **Editar** y 🗑 **Eliminar** en su propia receta (en la tarjeta y dentro del detalle).

⚠️ **Importante sobre esta cuenta**: es un inicio de sesión "de mentira" pensado para practicar el flujo, no un sistema de seguridad real. Los usuarios y contraseñas se guardan en `localStorage`, en texto codificado pero **no cifrado de verdad**, y solo existen en tu navegador — nadie más los ve, pero tampoco es seguro para contraseñas que uses en otros sitios. Si más adelante quieres que el registro sea real y compartido entre dispositivos, se necesita un backend con autenticación de verdad (por ejemplo, Firebase Authentication, gratuito en su capa básica) — puedo ayudarte con ese paso cuando quieras.

## Descargar receta en PDF
Dentro del detalle de cada receta hay un botón **"📄 Descargar receta en PDF"**. Genera el PDF en el propio navegador (con la librería gratuita [jsPDF](https://github.com/parallax/jsPDF), cargada desde un CDN público) e incluye título, categoría, autor, tiempo, descripción, ingredientes, pasos y la primera foto si tiene.

Si la persona **no ha iniciado sesión**, al hacer clic se cierra el detalle y se abre automáticamente el formulario de inicio de sesión/registro — solo después de entrar puede descargar.

## Contador de visitas
Arriba en el encabezado y en la sección de inicio verás un número de visitas que sube cada vez que alguien entra al sitio. Usa **CountAPI** (`https://api.countapi.xyz`), un servicio externo gratuito y sin registro que lleva la cuenta de forma compartida entre todas las personas que visiten la web, no solo en tu navegador.

⚠️ Dos cosas a tener en cuenta:
- Es un servicio de terceros gratuito, así que no hay garantía absoluta de que esté siempre disponible. Si en algún momento no responde, el sitio muestra un conteo de respaldo guardado en `localStorage` (marcado como "solo tu navegador") para no dejar el número en blanco.
- Antes de publicar el sitio en internet, cambia la constante `VISIT_NAMESPACE` en `script.js` por algo único (por ejemplo, tu dominio), para que tu contador no se mezcle con el de otro proyecto que use el mismo nombre por casualidad.

## Sobre las fotos y el video (importante)
Todo se guarda en el navegador con `localStorage`, así que las recetas persisten aunque cierres y vuelvas a abrir la página **en ese mismo navegador y dispositivo**.

- Las **fotos** se comprimen automáticamente y se guardan sin problema.
- El **video**, si lo subes como archivo, es demasiado pesado para guardarse de forma permanente en el navegador: se ve perfecto mientras dura la sesión, pero se pierde al recargar la página. Por eso el formulario también ofrece la opción de **pegar un enlace de YouTube** (puedes subir el video como "oculto" en YouTube, es gratis) — esa opción sí queda guardada para siempre.

Si más adelante quieres que las recetas se compartan entre distintas personas y dispositivos (no solo en tu navegador), vas a necesitar una base de datos real y un pequeño servidor (por ejemplo, Firebase en su capa gratuita). Puedo ayudarte a dar ese paso cuando quieras.

## Personalizar
- **Correo de contacto**: cambia la constante `CONTACT_EMAIL` al inicio de `script.js` (y el texto del enlace en `index.html` si quieres).
- **Colores**: están todos definidos como variables al inicio de `style.css`, dentro de `:root`.
- **Texto de bienvenida / recetas de ejemplo**: edítalos en `index.html` y en la función `seedIfEmpty()` de `script.js`.
