/* =========================================================
   EL RECETARIO — lógica de la aplicación (versión Firebase)
   Las recetas y las cuentas ahora se guardan en una base de datos
   compartida (Firestore) y en Firebase Authentication, así que
   TODAS las personas que visiten la web ven las mismas recetas.

   Las fotos se guardan comprimidas como texto (base64) dentro del
   propio documento de la receta en Firestore — así evitamos usar
   Firebase Cloud Storage, que hoy en día pide una tarjeta vinculada
   aunque no cobre nada. Por eso limitamos a 3 fotos por receta.

   El video solo se admite como enlace de YouTube (no como archivo),
   por la misma razón: no hay dónde guardar el archivo sin Storage.
========================================================= */

/* =========================================================
   1) CONFIGURA AQUÍ TU PROYECTO DE FIREBASE
   Reemplaza estos valores por los que copiaste de la consola de
   Firebase (Configuración del proyecto → tus apps → SDK de Firebase).
========================================================= */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAI0GU-Bx8e7XxWU-CAfajbrNO0g0-mELA",
  authDomain: "el-recetario-ac5b5.firebaseapp.com",
  projectId: "el-recetario-ac5b5",
  storageBucket: "el-recetario-ac5b5.firebasestorage.app",
  messagingSenderId: "590184451966",
  appId: "1:590184451966:web:1a5d89cd376d71e45c2d2f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const recetasRef = db.collection("recetas");

/* Correos con permisos de administrador: pueden editar o eliminar
   CUALQUIER receta. Debe coincidir exactamente con la lista que
   pongas en tus reglas de seguridad de Firestore (firestore.rules). */
const ADMIN_EMAILS = ["disenosrla@gmail.com"];

const CONTACT_EMAIL = "disenosrla@gmail.com"; // <- cambia este correo por el tuyo
const MAX_FOTOS = 3;

let recipes = [];
let currentUser = null; // { email, nombre, isAdmin } | null
let currentFilter = "todas";
let currentSearch = "";
let pendingPhotos = [];
let pendingVideo = null;   // { type: 'link', src } | null
let editingId = null;

/* ---------- Utilidades ---------- */
function truncate(str, n){ return str.length > n ? str.slice(0, n).trim() + "…" : str; }
function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function showFormMsg(el, text, isError){
  el.textContent = text;
  el.classList.toggle("is-error", !!isError);
  setTimeout(() => { el.textContent = ""; }, 5000);
}
function friendlyAuthError(code){
  const map = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Intenta iniciar sesión.",
    "auth/invalid-email": "El correo no parece válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No hay ninguna cuenta con ese correo.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo."
  };
  return map[code] || "Ocurrió un error. Inténtalo de nuevo.";
}

/* =========================================================
   2) SESIÓN: Firebase mantiene la sesión iniciada automáticamente,
   incluso si cierras y vuelves a abrir el navegador.
========================================================= */
auth.onAuthStateChanged(user => {
  if(user){
    currentUser = {
      email: user.email,
      nombre: user.displayName || user.email.split("@")[0],
      isAdmin: ADMIN_EMAILS.includes(user.email)
    };
  } else {
    currentUser = null;
  }
  updateAuthUI();
});

/* =========================================================
   3) RECETAS: escuchamos la colección en tiempo real. Cada vez que
   cualquier persona publica, edita o borra una receta, el listado
   se actualiza solo, para todo el mundo.
========================================================= */
recetasRef.orderBy("fecha", "desc").onSnapshot(
  (snapshot) => {
    recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderGrid();
  },
  (error) => {
    console.error("No se pudieron leer las recetas:", error);
  }
);

/* ---------- Render de tarjetas ---------- */
const grid = document.getElementById("recipeGrid");
const emptyState = document.getElementById("emptyState");

function renderGrid(){
  const term = currentSearch.trim().toLowerCase();

  const filtered = recipes
    .filter(r => currentFilter === "todas" || r.categoria === currentFilter)
    .filter(r => {
      if(!term) return true;
      const haystack = (r.titulo + " " + (r.ingredientes||[]).join(" ") + " " + (r.descripcion||"")).toLowerCase();
      return haystack.includes(term);
    });

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
  if(delBtn) delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteRecipe(r.id); });

  const editBtn = card.querySelector(".edit-btn");
  if(editBtn) editBtn.addEventListener("click", (e) => { e.stopPropagation(); startEdit(r.id); });

  return card;
}

function deleteRecipe(id){
  if(!confirm("¿Eliminar esta receta? Esta acción no se puede deshacer.")) return;
  recetasRef.doc(id).delete()
    .then(() => closeModal())
    .catch(err => alert("No se pudo eliminar: " + friendlyFirestoreError(err)));
}

function friendlyFirestoreError(err){
  if(err && err.code === "permission-denied") return "No tienes permiso para hacer esto.";
  return (err && err.message) || "error desconocido";
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
  if(r.video && r.video.src){
    const embed = toYoutubeEmbed(r.video.src);
    videoHtml = embed
      ? `<h4>Video del proceso</h4><iframe src="${embed}" allowfullscreen></iframe>`
      : `<h4>Video del proceso</h4><p><a href="${r.video.src}" target="_blank" rel="noopener">Ver video ↗</a></p>`;
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
    document.getElementById("modalEditBtn").addEventListener("click", () => { closeModal(); startEdit(r.id); });
    document.getElementById("modalDeleteBtn").addEventListener("click", () => { deleteRecipe(r.id); });
  }
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

  doc.setFillColor(255, 111, 60);
  doc.rect(0, 0, pageWidth, 10, "F");

  addWrapped(r.titulo, 22, true, 28);
  addWrapped(`${r.categoria === "dulce" ? "Dulce" : "Comida"} · Por ${r.autor || "anónimo"}${r.tiempo ? " · " + r.tiempo : ""}`, 11, false, 18, "#7A5A63");
  y += 6;

  if(r.fotos && r.fotos[0]){
    try{
      const imgW = 200, imgH = 150;
      doc.addImage(r.fotos[0], "JPEG", marginX, y, imgW, imgH);
      y += imgH + 20;
    }catch(e){ /* seguimos sin la imagen si falla */ }
  }

  if(r.descripcion){ addWrapped(r.descripcion, 11.5, false, 16); y += 8; }

  addWrapped("Ingredientes", 14, true, 20, "#E4551F");
  (r.ingredientes || []).forEach(i => addWrapped("• " + i, 11, false, 16));
  y += 8;

  addWrapped("Preparación", 14, true, 20, "#E4551F");
  (r.pasos || []).forEach((p, i) => addWrapped(`${i + 1}. ${p}`, 11, false, 16));

  y += 24;
  addWrapped("Descargado desde El Recetario", 9, false, 12, "#B9A6AC");

  const nombreArchivo = (r.titulo || "receta").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`${nombreArchivo || "receta"}.pdf`);
}

/* ---------- Formulario: subir fotos (máx. 3, comprimidas) ---------- */
const photoInput = document.getElementById("rPhotos");
const photoPreview = document.getElementById("photoPreview");

photoInput.addEventListener("change", async () => {
  const disponibles = MAX_FOTOS - pendingPhotos.length;
  if(disponibles <= 0){
    alert(`Ya tienes ${MAX_FOTOS} fotos. Quita alguna si quieres agregar otra.`);
    photoInput.value = "";
    return;
  }
  const files = Array.from(photoInput.files).slice(0, disponibles);
  for(const file of files){
    const dataUrl = await resizeImage(file, 700, 0.72);
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

/* ---------- Formulario: video (solo enlace de YouTube) ---------- */
const videoLinkInput = document.getElementById("rVideoLink");
const videoPreview = document.getElementById("videoPreview");

videoLinkInput.addEventListener("input", () => {
  const val = videoLinkInput.value.trim();
  pendingVideo = val ? { type: "link", src: val } : null;
  renderVideoPreview();
});

function renderVideoPreview(){
  if(!pendingVideo){ videoPreview.innerHTML = ""; return; }
  videoPreview.innerHTML = `
    <div class="video-preview-link">🔗 Enlace listo
      <button type="button" class="remove" id="removeVideo" style="position:static;">✕</button>
    </div>`;
  document.getElementById("removeVideo").addEventListener("click", () => {
    pendingVideo = null;
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

  submitRecipeBtn.disabled = true;

  if(editingId){
    recetasRef.doc(editingId).update(camposComunes)
      .then(() => { showFormMsg(formMsg, "¡Cambios guardados! ✏️", false); resetFormToCreateMode(); scrollToRecetas(); })
      .catch(err => showFormMsg(formMsg, friendlyFirestoreError(err), true))
      .finally(() => { submitRecipeBtn.disabled = false; });
  } else {
    recetasRef.add({
      ...camposComunes,
      autor: currentUser.nombre,
      autorEmail: currentUser.email,
      fecha: Date.now()
    })
      .then(() => { showFormMsg(formMsg, "¡Receta publicada! Ya la puede ver cualquier visitante 🎉", false); resetFormToCreateMode(); scrollToRecetas(); })
      .catch(err => showFormMsg(formMsg, friendlyFirestoreError(err), true))
      .finally(() => { submitRecipeBtn.disabled = false; });
  }
});

function scrollToRecetas(){
  document.getElementById("recetas").scrollIntoView({ behavior: "smooth" });
}

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
  videoLinkInput.value = pendingVideo ? pendingVideo.src : "";

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

  if(!nombre || !email || pass.length < 6){
    showFormMsg(registerMsg, "Completa tu nombre, correo y una contraseña de al menos 6 caracteres.", true);
    return;
  }

  auth.createUserWithEmailAndPassword(email, pass)
    .then(cred => cred.user.updateProfile({ displayName: nombre }))
    .then(() => closeAuthModal())
    .catch(err => showFormMsg(registerMsg, friendlyAuthError(err.code), true));
});

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const pass = document.getElementById("loginPass").value;

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => closeAuthModal())
    .catch(err => showFormMsg(loginMsg, friendlyAuthError(err.code), true));
});

document.getElementById("btnLogout").addEventListener("click", () => auth.signOut());

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

/* ---------- Menú móvil ---------- */
const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");
navToggle.addEventListener("click", () => mainNav.classList.toggle("is-open"));
mainNav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mainNav.classList.remove("is-open")));

/* =========================================================
   Contador de visitas en tiempo real (CountAPI, servicio externo
   gratuito, no requiere cuenta). Sigue funcionando igual que antes,
   independiente de Firebase.
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

/* ---------- Inicio ---------- */
trackVisit();
