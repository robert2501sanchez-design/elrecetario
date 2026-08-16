# El Recetario 🥄

Blog de recetas (comida y dulces) hecho con HTML, CSS y JavaScript puro, con **Firebase** como base de datos y sistema de cuentas compartido. Sin frameworks, sin servicios de pago.

## Archivos
- `index.html` — estructura de la página
- `style.css` — todos los estilos (colores, tipografía, diseño)
- `script.js` — toda la lógica (Firebase, filtros, subir fotos/video, PDF, visitas, contacto)
- `firestore.rules` — reglas de seguridad que debes pegar en la consola de Firebase

## Cómo abrirlo en Visual Studio Code
1. Descarga los archivos en una misma carpeta, por ejemplo `recetario/`.
2. Abre esa carpeta en VS Code: **Archivo → Abrir carpeta…** (no "Abrir archivo", tiene que ser la carpeta completa).
3. Instala la extensión gratuita **Live Server** (de Ritwick Dey) desde la pestaña de extensiones.
4. Haz clic derecho sobre `index.html` → **Open with Live Server**.

## Configurar Firebase (paso a paso)
1. Entra a [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**. No pide tarjeta.
2. **Authentication** → "Comenzar" → pestaña "Sign-in method" → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → "Crear base de datos" → modo de prueba está bien para empezar (luego pegas las reglas de seguridad).
4. En la página principal del proyecto, clic en el icono **"</>"** (Web) para registrar tu app. Ponle un nombre y **NO actives Firebase Hosting** (ya usamos GitHub Pages).
5. Copia el objeto `firebaseConfig` que te muestra Firebase.
6. Abre `script.js` en VS Code y reemplaza el bloque `firebaseConfig` cerca del inicio del archivo con el tuyo:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. En la consola de Firebase, ve a **Firestore Database → Reglas**, borra lo que haya y pega el contenido completo de `firestore.rules`. Publica los cambios.
8. Sube (o vuelve a subir) los archivos actualizados a tu repositorio de GitHub para que la web publicada también use Firebase.

## Usuario administrador
Hay un correo con permisos de **administrador**: puede editar y eliminar **cualquier** receta.

⚠️ Debes cambiarlo en **dos lugares** para que quede sincronizado:
1. En `script.js`, la constante `ADMIN_EMAILS`.
2. En `firestore.rules`, dentro de la función `isAdmin()` (y volver a publicar las reglas en la consola de Firebase).

Regístrate en la web con ese correo y automáticamente tendrás el rol de administrador.

*(Esta lista de correos "a mano" es la forma más simple de tener administradores sin pagar por funciones extra de Firebase. Si el proyecto crece mucho, se puede automatizar con Cloud Functions, que sí requiere el plan de pago por uso.)*

## Qué cambió respecto a la versión anterior (localStorage)
Ahora las recetas y las cuentas se guardan en una base de datos real (Firestore) y en Firebase Authentication:
- **Antes**: cada quien veía solo lo que había guardado en su propio navegador.
- **Ahora**: todas las personas que entren a la web ven las mismas recetas, en tiempo real (si alguien publica una receta, aparece al instante en las pantallas de los demás visitantes).

Dos límites que se mantienen por seguir siendo 100% gratis (sin tarjeta):
- **Fotos**: máximo 3 por receta, se comprimen automáticamente y se guardan como texto dentro del propio documento (no se usa Firebase Storage, que hoy exige una tarjeta vinculada aunque no cobre).
- **Video**: solo se admite como enlace de YouTube (ya no se puede subir el archivo directamente), por la misma razón — no hay dónde guardar el archivo de video sin Storage.

## Descargar receta en PDF
Dentro del detalle de cada receta hay un botón "📄 Descargar receta en PDF" (usa la librería gratuita jsPDF). Si la persona no ha iniciado sesión, se abre automáticamente el login/registro.

## Contador de visitas
Sigue funcionando igual que antes, con el servicio externo gratuito CountAPI — es independiente de Firebase. Recuerda cambiar `VISIT_NAMESPACE` en `script.js` por algo único tuyo antes de publicar.

## Publicar en internet gratis (GitHub Pages)
1. Crea una cuenta en [github.com](https://github.com) (gratis).
2. Crea un repositorio nuevo, público, por ejemplo `recetario`.
3. Sube `index.html`, `style.css`, `script.js` y `README.md` (ya con tu `firebaseConfig` puesto).
4. En el repositorio: **Settings → Pages** → rama `main`, carpeta `/ (root)` → guardar.
5. Tu web queda publicada en `https://tuusuario.github.io/recetario/`.
6. (Opcional) Si compras un dominio propio, en la misma sección "Pages" puedes ponerlo en "Custom domain" y apuntar los DNS a las IPs de GitHub.

## Seguridad — qué es real y qué no
- El **login ahora sí es real**: Firebase Authentication protege las contraseñas de verdad (no las ve nadie, ni siquiera tú desde la consola).
- Las **reglas de Firestore** (`firestore.rules`) son las que de verdad impiden que alguien edite o borre una receta ajena — no basta con ocultar los botones en el diseño, por eso es indispensable pegarlas en la consola.
- Sigue siendo un proyecto pensado para aprender y para uso personal/pequeño: dentro del plan gratuito de Firebase (Spark) hay límites generosos de uso diario, pero si la web crece mucho conviene revisar la [documentación de precios de Firebase](https://firebase.google.com/pricing).
