/* =========================================================
   EL RECETARIO — lógica de la aplicación
   Guarda las recetas en localStorage (persisten en este navegador).
   Las fotos se guardan como imágenes comprimidas (base64).
   El video subido como archivo solo vive en la sesión actual
   (los videos pesan demasiado para localStorage); el enlace de
   YouTube sí queda guardado para siempre.
========================================================= */

const STORAGE_KEY = "elrecetario_recetas";
const USERS_KEY = "elrecetario_usuarios";
const SESSION_KEY = "elrecetario_sesion";
const CONTACT_EMAIL = "disenosrla@gmail.com"; // <- cambia este correo por el tuyo

/* Correos que tendrán permisos de administrador: pueden editar o eliminar
   CUALQUIER receta, no solo las suyas. Cambia esto por tu propio correo
   antes de registrarte, y agrega más separados por coma si necesitas
   varios administradores. */
const ADMIN_EMAILS = ["disenosrla@gmail.com"];

let recipes = loadRecipes();
let users = loadUsers();
let currentUser = loadSession(); // { email, nombre, isAdmin } | null
if(currentUser) currentUser.isAdmin = ADMIN_EMAILS.includes(currentUser.email);
let currentFilter = "todas";
let currentSearch = "";
let pendingPhotos = [];     // { dataUrl }
let pendingVideo = null;    // { type: 'file'|'link', src }
let editingId = null;       // id de la receta que se está editando, o null si es nueva

/* =========================================================
   NOTA IMPORTANTE SOBRE SEGURIDAD
   Este login es 100% del lado del navegador (no hay servidor).
   Las contraseñas se guardan en localStorage con una codificación
   simple, NO con un cifrado real. Sirve para practicar el flujo de
   registro/inicio de sesión y para separar "quién publicó qué" en
   este proyecto personal, pero no debe usarse para datos sensibles
   ni contraseñas reales. Para producción real se necesita un backend
   con autenticación de verdad (por ejemplo, Firebase Auth, gratuito
   en su capa básica).
========================================================= */

/* ---------- Datos de ejemplo la primera vez ---------- */
function seedIfEmpty(){
  if(recipes.length) return;
  recipes = [
    {
      id: cryptoId(),
      titulo: "Sopa de lentejas con hierbabuena",
      autor: "Marisol",
      autorEmail: null,
      categoria: "comida",
      tiempo: "45 min",
      descripcion: "La receta con la que crecí: sencilla, calentita y perfecta para los días de lluvia.",
      ingredientes: ["2 tazas de lentejas", "1 cebolla picada", "2 dientes de ajo", "1 zanahoria", "hierbabuena fresca", "sal y comino al gusto"],
      pasos: ["Sofreír la cebolla y el ajo hasta que doren.", "Agregar la zanahoria y las lentejas, cubrir con agua.", "Cocinar 30 minutos a fuego medio.", "Al final añadir la hierbabuena fresca y sazonar."],
      fotos: [],
      video: null,
      fecha: Date.now() - 86400000 * 3
    },
    {
      id: cryptoId(),
      titulo: "Brownies con corazón de dulce de leche",
      autor: "Renzo",
      autorEmail: null,
      categoria: "dulce",
      tiempo: "1 h",
      descripcion: "Bordes crujientes, centro fundente. El dulce de leche hace toda la magia.",
      ingredientes: ["200 g de chocolate oscuro", "150 g de mantequilla", "3 huevos", "1 taza de azúcar", "3/4 taza de harina", "media taza de dulce de leche"],
      pasos: ["Derretir el chocolate con la mantequilla.", "Batir los huevos con el azúcar e incorporar el chocolate.", "Añadir la harina con movimientos envolventes.", "Verter en un molde, agregar cucharadas de dulce de leche y hornear 25 minutos a 180°C."],
      fotos: [],
      video: null,
      fecha: Date.now() - 86400000
    }
  ];
  saveRecipes();
}

function cryptoId(){
  return "r_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

/* ---------- Persistencia ---------- */
function loadRecipes(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.warn("No se pudieron leer las recetas guardadas:", e);
    return [];
  }
}

function saveRecipes(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }catch(e){
    console.warn("No se pudo guardar (quizá el almacenamiento está lleno):", e);
  }
}

function loadUsers(){
  try{
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

function saveUsers(){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

function saveSession(){
  if(currentUser) localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  else localStorage.removeItem(SESSION_KEY);
}

// Codificación simple, NO es cifrado de verdad — ver nota arriba.
function encodePass(pass){
  return btoa(unescape(encodeURIComponent(pass)));
}

/* ---------- Render de tarjetas ---------- */
const grid = document.getElementById("recipeGrid");
const emptyState = document.getElementById("emptyState");

function renderGrid(){
  const term = currentSearch.trim().toLowerCase();

  const filtered = recipes
    .filter(r => currentFilter === "todas" || r.categoria === currentFilter)
    .filter(r => {
      if(!term) return true;
      const haystack = (r.titulo + " " + r.ingredientes.join(" ") + " " + r.descripcion).toLowerCase();
      return haystack.includes(term);
    })
    .sort((a,b) => b.fecha - a.fecha);

  grid.innerHTML = "";
  emptyState.hidden = filtered.length !== 0;

  filtered.forEach(r => grid.appendChild(buildCard(r)));
  updateStats();
}

function buildCard(r){
  const card = document.createElement("article");
  card.className = "recipe-card";
  card.dataset.id = r.id;

  const emoji = r.categoria === "dulce" ? "🍰" : "🥘";
  const thumbContent = r.fotos && r.fotos[0]
    ? `<img src="${r.fotos[0]}" alt="Foto de ${escapeHtml(r.titulo)}">`
    : emoji;

  const isOwner = !!(currentUser && r.autorEmail && currentUser.email === r.autorEmail);
  const canManage = isOwner || !!(currentUser && currentUser.isAdmin);
  const ownerActions = canManage ? `
      <div class="owner-actions">
        <button class="edit-btn" title="Editar receta" data-id="${r.id}">✏️</button>
        <button class="delete-btn" title="Eliminar receta" data-id="${r.id}">🗑</button>
      </div>` : "";

  card.innerHTML = `
    <div class="thumb">
      <span class="badge badge--${r.categoria}">${r.categoria === "dulce" ? "Dulce" : "Comida"}</span>
      ${r.video ? '<span class="video-flag">▶ video</span>' : ""}
      ${thumbContent}
    </div>
    <div class="body">
      <h3>${escapeHtml(r.titulo)}</h3>
      <p class="meta">Por ${escapeHtml(r.autor || "anónimo")}${r.tiempo ? " · " + escapeHtml(r.tiempo) : ""}</p>
      <p class="desc">${escapeHtml(truncate(r.descripcion || "", 90))}</p>
      <div class="card-footer">
        <span>Ver receta →</span>
        ${ownerActions}
      </div>
    </div>
  `;

  card.addEventListener("click", (e) => {
    if(e.target.closest(".delete-btn") || e.target.closest(".edit-btn")) return;
    openModal(r);
  });

  const delBtn = card.querySelector(".delete-btn");
  if(delBtn){
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteRecipe(r.id);
    });
  }

  const editBtn = card.querySelector(".edit-btn");
  if(editBtn){
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startEdit(r.id);
    });
  }

  return card;
}

function deleteRecipe(id){
  if(confirm("¿Eliminar esta receta? Esta acción no se puede deshacer.")){
    recipes = recipes.filter(x => x.id !== id);
    saveRecipes();
    renderGrid();
    closeModal();
  }
}

function truncate(str, n){
  return str.length > n ? str.slice(0, n).trim() + "…" : str;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateStats(){
  document.getElementById("statTotal").textContent = recipes.length;
  document.getElementById("statComida").textContent = recipes.filter(r => r.categoria === "comida").length;
  document.getElementById("statDulce").textContent = recipes.filter(r => r.categoria === "dulce").length;
}

/* ---------- Filtros y búsqueda ---------- */
document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if(!btn) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
  btn.classList.add("is-active");
  currentFilter = btn.dataset.filter;
  renderGrid();
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  currentSearch = e.target.value;
  renderGrid();
});

/* ---------- Modal de detalle ---------- */
const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");

function openModal(r){
  const galería = (r.fotos || []).map(src => `<img src="${src}" alt="Foto de ${escapeHtml(r.titulo)}">`).join("");
  const heroImg = r.fotos && r.fotos[0] ? `<img src="${r.fotos[0]}" alt="">` : (r.categoria === "dulce" ? "🍰" : "🥘");

  let videoHtml = "";
  if(r.video){
    if(r.video.type === "link"){
      const embed = toYoutubeEmbed(r.video.src);
      videoHtml = embed
        ? `<h4>Video del proceso</h4><iframe src="${embed}" allowfullscreen></iframe>`
        : `<h4>Video del proceso</h4><p><a href="${r.video.src}" target="_blank" rel="noopener">Ver video ↗</a></p>`;
    } else {
      videoHtml = `<h4>Video del proceso</h4><video src="${r.video.src}" controls></video>`;
    }
  }

  const isOwner = !!(currentUser && r.autorEmail && currentUser.email === r.autorEmail);
  const canManage = isOwner || !!(currentUser && currentUser.isAdmin);
  const ownerActions = canManage ? `
    <div class="modal-owner-actions">
      <button type="button" class="btn btn-ghost" id="modalEditBtn">✏️ Editar receta${!isOwner ? " (admin)" : ""}</button>
      <button type="button" class="btn btn-ghost" id="modalDeleteBtn">🗑 Eliminar${!isOwner ? " (admin)" : ""}</button>
    </div>` : "";

  modalContent.innerHTML = `
    <div class="m-thumb">${heroImg}</div>
    ${galería ? `<div class="m-gallery">${galería}</div>` : ""}
    <h3>${escapeHtml(r.titulo)}</h3>
    <div class="m-meta">
      <span>${r.categoria === "dulce" ? "🍰 Dulce" : "🥘 Comida"}</span>
      ${r.tiempo ? `<span>⏱ ${escapeHtml(r.tiempo)}</span>` : ""}
      <span>👩‍🍳 ${escapeHtml(r.autor || "anónimo")}</span>
    </div>
    <div class="modal-pdf-row">
      <button type="button" class="btn btn-primary" id="modalPdfBtn">📄 Descargar receta en PDF</button>
    </div>
    ${ownerActions}
    ${r.descripcion ? `<p>${escapeHtml(r.descripcion)}</p>` : ""}
    <h4>Ingredientes</h4>
    <ul>${(r.ingredientes||[]).map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    <h4>Preparación</h4>
    <ol>${(r.pasos||[]).map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ol>
    ${videoHtml}
  `;
  modalOverlay.classList.add("is-open");
  document.body.style.overflow = "hidden";

  document.getElementById("modalPdfBtn").addEventListener("click", () => {
    if(!currentUser){
      closeModal();
      openAuthModal("login");
      showFormMsg(loginMsg, "Inicia sesión para descargar recetas en PDF.", true);
      return;
    }
    downloadRecipePDF(r);
  });

  if(canManage){
    document.getElementById("modalEditBtn").addEventListener("click", () => {
      closeModal();
      startEdit(r.id);
    });
    document.getElementById("modalDeleteBtn").addEventListener("click", () => {
      deleteRecipe(r.id);
    });
  }
}

/* ---------- Descargar receta en PDF ---------- */
function downloadRecipePDF(r){
  if(!window.jspdf){
    alert("No se pudo cargar el generador de PDF. Revisa tu conexión a internet e inténtalo de nuevo.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  let y = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;

  function addWrapped(text, size, isBold, lineGap, colorHex){
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(colorHex || "#3B1F2B");
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach(line => {
      if(y > 780){ doc.addPage(); y = 56; }
      doc.text(line, marginX, y);
      y += lineGap;
    });
  }

  // Encabezado
  doc.setFillColor(255, 111, 60);
  doc.rect(0, 0, pageWidth, 10, "F");

  addWrapped(r.titulo, 22, true, 28);
  addWrapped(`${r.categoria === "dulce" ? "Dulce" : "Comida"} · Por ${r.autor || "anónimo"}${r.tiempo ? " · " + r.tiempo : ""}`, 11, false, 18, "#7A5A63");
  y += 6;

  // Foto principal, si existe
  if(r.fotos && r.fotos[0]){
    try{
      const imgW = 200, imgH = 150;
      doc.addImage(r.fotos[0], "JPEG", marginX, y, imgW, imgH);
      y += imgH + 20;
    }catch(e){ /* si la imagen no se puede insertar, seguimos sin ella */ }
  }

  if(r.descripcion){
    addWrapped(r.descripcion, 11.5, false, 16);
    y += 8;
  }

  addWrapped("Ingredientes", 14, true, 20, "#E4551F");
  (r.ingredientes || []).forEach(i => addWrapped("• " + i, 11, false, 16));
  y += 8;

  addWrapped("Preparación", 14, true, 20, "#E4551F");
  (r.pasos || []).forEach((p, i) => addWrapped(`${i + 1}. ${p}`, 11, false, 16));

  y += 24;
  addWrapped("Descargado desde El Recetario — elrecetario", 9, false, 12, "#B9A6AC");

  const nombreArchivo = (r.titulo || "receta").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`${nombreArchivo || "receta"}.pdf`);
}

function closeModal(){
  modalOverlay.classList.remove("is-open");
  document.body.style.overflow = "";
}
document.getElementById("modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if(e.target === modalOverlay) closeModal(); });
document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeModal(); });

function toYoutubeEmbed(url){
  try{
    const u = new URL(url);
    let id = "";
    if(u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if(u.hostname.includes("youtube.com")){
      if(u.pathname === "/watch") id = u.searchParams.get("v");
      else if(u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
      else if(u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }catch(e){ return null; }
}

/* ---------- Formulario: subir fotos ---------- */
const photoInput = document.getElementById("rPhotos");
const photoPreview = document.getElementById("photoPreview");

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files).slice(0, 6 - pendingPhotos.length);
  for(const file of files){
    const dataUrl = await resizeImage(file, 1000, 0.82);
    pendingPhotos.push(dataUrl);
  }
  photoInput.value = "";
  renderPhotoPreview();
});

function renderPhotoPreview(){
  photoPreview.innerHTML = pendingPhotos.map((src, i) => `
    <div class="preview-thumb">
      <img src="${src}" alt="Vista previa ${i+1}">
      <button type="button" class="remove" data-i="${i}" title="Quitar">✕</button>
    </div>
  `).join("");
  photoPreview.querySelectorAll(".remove").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingPhotos.splice(Number(btn.dataset.i), 1);
      renderPhotoPreview();
    });
  });
}

// Reduce el tamaño de la imagen para que quepa cómodamente en localStorage
function resizeImage(file, maxSize, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if(width > maxSize || height > maxSize){
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Formulario: video (archivo o enlace) ---------- */
const videoTabs = document.querySelectorAll(".video-tab");
const panelFile = document.getElementById("panel-file");
const panelLink = document.getElementById("panel-link");
const videoFileInput = document.getElementById("rVideoFile");
const videoLinkInput = document.getElementById("rVideoLink");
const videoPreview = document.getElementById("videoPreview");

videoTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    videoTabs.forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const isFile = tab.dataset.tab === "file";
    panelFile.hidden = !isFile;
    panelLink.hidden = isFile;
  });
});

videoFileInput.addEventListener("change", () => {
  const file = videoFileInput.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  pendingVideo = { type: "file", src: url };
  videoLinkInput.value = "";
  renderVideoPreview();
});

videoLinkInput.addEventListener("input", () => {
  const val = videoLinkInput.value.trim();
  pendingVideo = val ? { type: "link", src: val } : null;
  videoFileInput.value = "";
  renderVideoPreview();
});

function renderVideoPreview(){
  if(!pendingVideo){ videoPreview.innerHTML = ""; return; }
  if(pendingVideo.type === "file"){
    videoPreview.innerHTML = `
      <div class="preview-thumb">
        <video src="${pendingVideo.src}" muted></video>
        <button type="button" class="remove" id="removeVideo">✕</button>
      </div>`;
  } else {
    videoPreview.innerHTML = `
      <div class="video-preview-link">🔗 Enlace listo
        <button type="button" class="remove" id="removeVideo" style="position:static;">✕</button>
      </div>`;
  }
  document.getElementById("removeVideo").addEventListener("click", () => {
    pendingVideo = null;
    videoFileInput.value = "";
    videoLinkInput.value = "";
    renderVideoPreview();
  });
}

/* ---------- Formulario: publicar / editar receta ---------- */
const recipeForm = document.getElementById("recipeForm");
const formMsg = document.getElementById("formMsg");
const shareGate = document.getElementById("shareGate");
const editingFlag = document.getElementById("editingFlag");
const submitRecipeBtn = document.getElementById("submitRecipeBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

recipeForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if(!currentUser){
    showFormMsg(formMsg, "Debes iniciar sesión para publicar una receta.", true);
    return;
  }

  const data = new FormData(recipeForm);
  const titulo = data.get("titulo").trim();
  const ingredientesRaw = data.get("ingredientes").trim();
  const pasosRaw = data.get("pasos").trim();

  if(!titulo || !ingredientesRaw || !pasosRaw){
    showFormMsg(formMsg, "Completa al menos el nombre, los ingredientes y la preparación.", true);
    return;
  }

  const camposComunes = {
    titulo,
    categoria: data.get("categoria"),
    tiempo: data.get("tiempo").trim(),
    descripcion: data.get("descripcion").trim(),
    ingredientes: ingredientesRaw.split("\n").map(s => s.trim()).filter(Boolean),
    pasos: pasosRaw.split("\n").map(s => s.trim()).filter(Boolean),
    fotos: [...pendingPhotos],
    video: pendingVideo
  };

  if(editingId){
    const idx = recipes.findIndex(r => r.id === editingId);
    if(idx === -1){
      showFormMsg(formMsg, "Esta receta ya no existe.", true);
      resetFormToCreateMode();
      return;
    }
    if(recipes[idx].autorEmail !== currentUser.email && !currentUser.isAdmin){
      showFormMsg(formMsg, "Solo puedes editar tus propias recetas.", true);
      resetFormToCreateMode();
      return;
    }
    recipes[idx] = { ...recipes[idx], ...camposComunes };
    saveRecipes();
    renderGrid();
    showFormMsg(formMsg, "¡Cambios guardados! ✏️", false);
  } else {
    const nueva = {
      id: cryptoId(),
      ...camposComunes,
      autor: currentUser.nombre,
      autorEmail: currentUser.email,
      fecha: Date.now()
    };
    recipes.push(nueva);
    saveRecipes();
    renderGrid();
    showFormMsg(formMsg, "¡Receta publicada! Ya aparece en la sección de recetas 🎉", false);
  }

  resetFormToCreateMode();
  document.getElementById("recetas").scrollIntoView({ behavior: "smooth" });
});

cancelEditBtn.addEventListener("click", resetFormToCreateMode);

function startEdit(id){
  const r = recipes.find(x => x.id === id);
  if(!r) return;
  const canManage = currentUser && (currentUser.email === r.autorEmail || currentUser.isAdmin);
  if(!canManage){
    alert("Solo la persona que publicó esta receta (o un administrador) puede editarla.");
    return;
  }

  editingId = id;
  document.getElementById("rTitle").value = r.titulo;
  document.getElementById("rTime").value = r.tiempo || "";
  document.getElementById("rDesc").value = r.descripcion || "";
  document.getElementById("rIngredients").value = (r.ingredientes || []).join("\n");
  document.getElementById("rSteps").value = (r.pasos || []).join("\n");
  document.querySelector(`.radio-pill--${r.categoria} input`).checked = true;

  pendingPhotos = [...(r.fotos || [])];
  pendingVideo = r.video ? { ...r.video } : null;
  renderPhotoPreview();
  renderVideoPreview();
  if(pendingVideo && pendingVideo.type === "link"){
    document.querySelector('.video-tab[data-tab="link"]').click();
    document.getElementById("rVideoLink").value = pendingVideo.src;
  } else {
    document.querySelector('.video-tab[data-tab="file"]').click();
  }

  editingFlag.hidden = false;
  submitRecipeBtn.textContent = "Guardar cambios";
  cancelEditBtn.hidden = false;

  document.getElementById("compartir").scrollIntoView({ behavior: "smooth" });
}

function resetFormToCreateMode(){
  recipeForm.reset();
  pendingPhotos = [];
  pendingVideo = null;
  editingId = null;
  renderPhotoPreview();
  renderVideoPreview();
  document.querySelector('.radio-pill--comida input').checked = true;
  editingFlag.hidden = true;
  submitRecipeBtn.textContent = "Publicar receta";
  cancelEditBtn.hidden = true;
}

function showFormMsg(el, text, isError){
  el.textContent = text;
  el.classList.toggle("is-error", !!isError);
  setTimeout(() => { el.textContent = ""; }, 5000);
}

/* ---------- Candado de "Compartir" según sesión ---------- */
function updateShareGate(){
  if(currentUser){
    shareGate.hidden = true;
    recipeForm.hidden = false;
  } else {
    shareGate.hidden = false;
    recipeForm.hidden = true;
    resetFormToCreateMode();
  }
}

/* ---------- Formulario de contacto (mailto) ---------- */
document.getElementById("contactEmailLink").href = `mailto:${CONTACT_EMAIL}`;
document.getElementById("contactEmailLink").textContent = CONTACT_EMAIL;

const contactForm = document.getElementById("contactForm");
contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("cName").value.trim();
  const email = document.getElementById("cEmail").value.trim();
  const msg = document.getElementById("cMsg").value.trim();

  if(!name || !email || !msg){
    showFormMsg(document.getElementById("contactMsg"), "Completa todos los campos.", true);
    return;
  }

  const subject = encodeURIComponent(`Mensaje de ${name} desde El Recetario`);
  const body = encodeURIComponent(`${msg}\n\n— ${name} (${email})`);
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  showFormMsg(document.getElementById("contactMsg"), "Abriendo tu cliente de correo…", false);
  contactForm.reset();
});

/* ---------- Autenticación: registro, login, logout ---------- */
const authOverlay = document.getElementById("authOverlay");
const authClose = document.getElementById("authClose");
const authTabs = document.querySelectorAll(".auth-tabs .video-tab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");

const authButtons = document.getElementById("authButtons");
const userArea = document.getElementById("userArea");
const userGreeting = document.getElementById("userGreeting");

function openAuthModal(tab){
  showAuthTab(tab || "login");
  authOverlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
}
function closeAuthModal(){
  authOverlay.classList.remove("is-open");
  document.body.style.overflow = "";
  loginForm.reset(); registerForm.reset();
  loginMsg.textContent = ""; registerMsg.textContent = "";
}
function showAuthTab(tab){
  authTabs.forEach(t => t.classList.toggle("is-active", t.dataset.authtab === tab));
  loginForm.hidden = tab !== "login";
  registerForm.hidden = tab !== "register";
}

document.getElementById("btnShowLogin").addEventListener("click", () => openAuthModal("login"));
document.getElementById("btnShowRegister").addEventListener("click", () => openAuthModal("register"));
document.getElementById("gateLoginBtn").addEventListener("click", () => openAuthModal("login"));
document.getElementById("gateRegisterBtn").addEventListener("click", () => openAuthModal("register"));
authClose.addEventListener("click", closeAuthModal);
authOverlay.addEventListener("click", (e) => { if(e.target === authOverlay) closeAuthModal(); });
authTabs.forEach(tab => tab.addEventListener("click", () => showAuthTab(tab.dataset.authtab)));

registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const pass = document.getElementById("regPass").value;

  if(!nombre || !email || pass.length < 4){
    showFormMsg(registerMsg, "Completa tu nombre, correo y una contraseña de al menos 4 caracteres.", true);
    return;
  }
  if(users.some(u => u.email === email)){
    showFormMsg(registerMsg, "Ya existe una cuenta con ese correo. Intenta iniciar sesión.", true);
    return;
  }

  const nuevoUsuario = { nombre, email, pass: encodePass(pass) };
  users.push(nuevoUsuario);
  saveUsers();

  currentUser = { nombre, email, isAdmin: ADMIN_EMAILS.includes(email) };
  saveSession();
  updateAuthUI();
  closeAuthModal();
});

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const pass = document.getElementById("loginPass").value;

  const user = users.find(u => u.email === email);
  if(!user || user.pass !== encodePass(pass)){
    showFormMsg(loginMsg, "Correo o contraseña incorrectos.", true);
    return;
  }

  currentUser = { nombre: user.nombre, email: user.email, isAdmin: ADMIN_EMAILS.includes(user.email) };
  saveSession();
  updateAuthUI();
  closeAuthModal();
});

document.getElementById("btnLogout").addEventListener("click", () => {
  currentUser = null;
  saveSession();
  updateAuthUI();
});

function updateAuthUI(){
  if(currentUser){
    authButtons.hidden = true;
    userArea.hidden = false;
    userGreeting.textContent = currentUser.nombre + (currentUser.isAdmin ? " 🛡️ (admin)" : "");
  } else {
    authButtons.hidden = false;
    userArea.hidden = true;
  }
  updateShareGate();
  renderGrid();
}

/* =========================================================
   Contador de visitas en tiempo real
   Usa CountAPI (https://countapi.xyz), un servicio gratuito y sin
   necesidad de registro: cada carga de la página suma 1 al contador
   global (compartido por todas las personas que visiten el sitio,
   no solo en este navegador). Si no hay internet o el servicio no
   responde, usamos un respaldo local solo para no dejar el número
   en blanco (se aclara en pantalla que ese conteo es local).

   IMPORTANTE si vas a publicar este sitio: cambia VISIT_NAMESPACE
   por algo único (por ejemplo tu dominio), para que tu contador no
   se mezcle con el de otro proyecto que use el mismo nombre.
========================================================= */
const VISIT_NAMESPACE = "elrecetario-robertsanchez-2026";
const VISIT_KEY = "visitas";

async function trackVisit(){
  const targets = [document.getElementById("statVisits"), document.getElementById("liveVisits")];
  try{
    const res = await fetch(`https://api.countapi.xyz/hit/${VISIT_NAMESPACE}/${VISIT_KEY}`);
    if(!res.ok) throw new Error("Respuesta no válida");
    const data = await res.json();
    const formatted = Number(data.value).toLocaleString("es");
    targets.forEach(el => { if(el) el.textContent = formatted; });
  }catch(e){
    const local = Number(localStorage.getItem("elrecetario_visitas_local") || 0) + 1;
    localStorage.setItem("elrecetario_visitas_local", local);
    const formatted = local.toLocaleString("es") + " (solo tu navegador)";
    targets.forEach(el => { if(el) el.textContent = formatted; });
  }
}

/* ---------- Menú móvil ---------- */
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");
navToggle.addEventListener("click", () => mainNav.classList.toggle("is-open"));
mainNav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mainNav.classList.remove("is-open")));

/* ---------- Inicio ---------- */
seedIfEmpty();
updateAuthUI();
trackVisit();
