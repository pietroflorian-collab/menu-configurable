import { auth, db, MenuAPI, escapeHTML, showToast } from './api.js';
import { UI } from './ui.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { initializeApp, getApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

const AuthManager = {
  currentUser: null,
  userRole: null,

  init() {
    onAuthStateChanged(auth, async (user) => {
      const loginOverlay = document.getElementById('login-overlay');
      const adminLayout = document.getElementById('admin-layout');

      if (user) {
        this.currentUser = user;
        try {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userDocRef);
          this.userRole = userSnap.exists() ? userSnap.data().rol : (user.uid === 'Po6AVxgzVsQRzt28xw8p29T5YN03' ? 'superadmin' : null);

          if (this.userRole) {
            loginOverlay.classList.add('hidden');
            if (adminLayout) adminLayout.classList.remove('hidden');
            SukidesuAdmin.init(); 
          } else {
            throw new Error("Usuario sin roles asignados.");
          }
        } catch (error) {
          console.error(error);
          showToast("Acceso denegado.", "error");
          this.logout();
        }
      } else {
        loginOverlay.classList.remove('hidden');
        if (adminLayout) adminLayout.classList.add('hidden');
      }
    });

    document.getElementById('login-form')?.addEventListener('submit', (e) => this.login(e));
  },

  async login(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const btn = document.getElementById('login-btn');
    
    btn.innerText = "Verificando..."; btn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      showToast("Credenciales inválidas", "error");
    } finally {
      btn.innerText = "Ingresar"; btn.disabled = false;
    }
  },

  logout() {
    signOut(auth);
  },

  async registrarEmpleado(email, pass, rolAsignado) {
    if (this.userRole === 'editor' || (this.userRole === 'administrador' && rolAsignado !== 'editor')) {
      showToast("No tienes privilegios para crear este perfil", "error");
      return;
    }

    const secondaryApp = initializeApp(getApp(), "WorkerApp");
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await setDoc(doc(db, 'usuarios', res.user.uid), { rol: rolAsignado });
      showToast(`Perfil (${rolAsignado}) creado con éxito`, "success");
    } catch (error) {
      showToast(`Error al crear empleado: ${error.message}`, "error");
    } finally {
      await deleteApp(secondaryApp); 
    }
  }
};

const SukidesuAdmin = {
  adminItems: [], adminCategories: [], adminConfig: {},
  selectedCategory: "", searchQuery: "", customQRLogo: null,
  cropperInstance: null, pendingImageBase64: null,

  init() {
    this.bindEvents();
    this.loadAdminData();
    this.enableDragScroll("admin-category-bar");
  },

  bindEvents() {
    const bindClick = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    bindClick("nav-promo-btn", () => this.openPromoModal());
    bindClick("nav-qr-btn", () => this.openQRModal());
    bindClick("nav-add-btn", () => this.openModal());
    bindClick("nav-cat-btn", () => this.openCategoryModal());
    bindClick("mobile-promo-btn", () => this.openPromoModal());
    bindClick("mobile-qr-btn", () => this.openQRModal());
    bindClick("mobile-new-btn", () => this.openModal()); 
    
    bindClick("close-promo-btn", () => this.closeModalHelper("promoConfigModal"));
    bindClick("close-qr-btn", () => this.closeModalHelper("qrModal"));
    bindClick("close-cat-btn", () => this.closeModalHelper("categoryModal"));
    bindClick("close-item-btn", () => this.closeModalHelper("itemModal"));
    bindClick("cancel-item-btn", () => this.closeModalHelper("itemModal"));
    bindClick("close-cropper-btn", () => this.cancelCrop());
    bindClick("cancel-cropper-btn", () => this.cancelCrop());
    
    bindClick("promo-save-btn", () => this.savePromoConfig());
    bindClick("qr-download-btn", () => this.downloadAdminQR());
    bindClick("confirm-crop-btn", () => this.confirmCrop());
    
    document.getElementById("admin-search-input")?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById("itemForm")?.addEventListener('submit', (e) => this.handleFormSubmit(e));
    document.getElementById("catForm")?.addEventListener('submit', (e) => this.handleCreateCategorySubmit(e));
    
    document.getElementById("qr-input-url")?.addEventListener('input', () => this.renderAdminQR());
    document.getElementById("qr-input-file")?.addEventListener('change', (e) => this.handleQRImageUpload(e));
    document.getElementById("qr-input-texto")?.addEventListener('input', () => this.renderAdminQR());
    
    // Selector interactivo de archivo local para el plato
    document.getElementById("item-file-input")?.addEventListener('change', (e) => this.handleItemFileUpload(e));
    
    ['item-nombre', 'item-precio', 'item-categoria', 'item-descripcion', 'item-promo-texto'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateModalPreview());
    });
    document.getElementById('item-picante')?.addEventListener('change', () => this.updateModalPreview());

    ['config-promo-texto', 'config-promo-img'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updatePromoPreview());
    });
    document.getElementById('config-promo-activa')?.addEventListener('change', () => this.updatePromoPreview());

    document.getElementById("admin-category-bar")?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-category]');
      if (btn) this.filterAdminCategory(btn.dataset.category);
    });

    document.getElementById("admin-grid")?.addEventListener('click', (e) => {
      if (e.target.dataset.expandable) e.target.classList.toggle('line-clamp-3');
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle-pause') this.togglePausado(btn.dataset.id);
      if (btn.dataset.action === 'edit') this.editItem(btn.dataset.id);
      if (btn.dataset.action === 'delete') this.deleteItem(btn.dataset.id);
    });

    document.getElementById("category-manage-list")?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle-cat') this.toggleCategoryPause(btn.dataset.id, btn.dataset.state === 'true');
      if (btn.dataset.action === 'delete-cat') this.deleteCategory(btn.dataset.id);
    });
  },

  enableDragScroll(id) {
    const slider = document.getElementById(id);
    if (!slider) return;
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => isDown = false);
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); slider.scrollLeft = scrollLeft - ((e.pageX - slider.offsetLeft) - startX) * 2; });
    slider.addEventListener('wheel', (e) => { if (e.deltaY !== 0) { e.preventDefault(); slider.scrollLeft += e.deltaY; } }, { passive: false });
  },

  async loadAdminData() {
    document.getElementById("admin-loading").classList.remove("hidden");
    document.getElementById("admin-grid").classList.add("hidden");
    const res = await MenuAPI.fetchItems(true);
    this.adminItems = res.items || [];
    this.adminCategories = res.categories || [];
    this.adminConfig = res.config || {};
    document.getElementById("admin-loading").classList.add("hidden");
    document.getElementById("admin-grid").classList.remove("hidden");
    this.populateCategorySelect();
    this.setupAdminCategories();
    this.renderAdminGrid();
  },

  openModalHelper(id) { document.getElementById(id)?.classList.replace("hidden", "flex"); },
  closeModalHelper(id) { document.getElementById(id)?.classList.replace("flex", "hidden"); },

  // ==========================================
  // FLUJO DE CROPPER Y GITHUB
  // ==========================================
  handleItemFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { 
      const imgElement = document.getElementById('cropper-image');
      imgElement.src = e.target.result;
      
      this.openModalHelper("cropperModal");
      
      if (this.cropperInstance) {
        this.cropperInstance.destroy();
      }

      setTimeout(() => {
        imgElement.classList.remove("opacity-0");
        this.cropperInstance = new Cropper(imgElement, {
          aspectRatio: 3 / 4,
          viewMode: 1,
          autoCropArea: 0.9,
          dragMode: 'move',
          background: false
        });
      }, 100);
    };
    reader.readAsDataURL(file);
  },

  cancelCrop() {
    this.closeModalHelper("cropperModal");
    document.getElementById('item-file-input').value = "";
    document.getElementById('cropper-image').classList.add("opacity-0");
  },

  confirmCrop() {
    if (!this.cropperInstance) return;
    const canvas = this.cropperInstance.getCroppedCanvas({
      width: 600,
      height: 800
    });
    
    const base64Url = canvas.toDataURL('image/webp', 0.8);
    this.pendingImageBase64 = base64Url.split(',')[1];
    document.getElementById("item-imagen-url").value = base64Url;
    
    this.updateModalPreview();
    this.closeModalHelper("cropperModal");
    document.getElementById('cropper-image').classList.add("opacity-0");
  },

  async uploadToGitHub() {
    if (!this.pendingImageBase64) return document.getElementById("item-imagen-url").value;

    const secretSnap = await getDoc(doc(db, "sistema", "secretos"));
    if (!secretSnap.exists()) throw new Error("Acceso denegado: Token no encontrado en Firestore.");
    const token = secretSnap.data().token_github;

    const nombreArchivo = `plato_${Date.now()}.webp`;
    const repoPath = `sukidesumenu-svg/menu_sukidesu2`;
    const githubApiUrl = `https://api.github.com/repos/${repoPath}/contents/assets/img/${nombreArchivo}`;

    const res = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload imagen de plato: ${nombreArchivo}`,
        content: this.pendingImageBase64,
        branch: "main"
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Fallo en GitHub API: ${errorData.message}`);
    }

    this.pendingImageBase64 = null;
    return `https://raw.githubusercontent.com/${repoPath}/main/assets/img/${nombreArchivo}`;
  },

  // ==========================================
  // RESTO DE MÉTODOS DE UI Y CRUD
  // ==========================================
  openPromoModal() {
    document.getElementById("config-promo-activa").checked = String(this.adminConfig.promo_activa).toLowerCase() === "true";
    document.getElementById("config-promo-texto").value = this.adminConfig.promo_texto || "";
    document.getElementById("config-promo-img").value = this.adminConfig.promo_imagen || "";
    this.updatePromoPreview();
    this.openModalHelper("promoConfigModal");
  },

  updatePromoPreview() {
    const texto = document.getElementById("config-promo-texto").value || "Tu texto aparecerá aquí...";
    const url = document.getElementById("config-promo-img").value.trim();
    document.getElementById("admin-preview-promo-texto").innerText = texto;
    const imgEl = document.getElementById("admin-preview-promo-img");
    if (url) { imgEl.src = url; imgEl.classList.remove("hidden"); } 
    else { imgEl.src = ""; imgEl.classList.add("hidden"); }
  },

  async savePromoConfig() {
    const btn = document.getElementById("promo-save-btn");
    btn.innerText = "Guardando..."; btn.disabled = true;
    const payload = { 
      promo_activa: document.getElementById("config-promo-activa").checked.toString(), 
      promo_texto: document.getElementById("config-promo-texto").value, 
      promo_imagen: document.getElementById("config-promo-img").value 
    };
    
    try {
      const res = await MenuAPI.updateConfig(payload);
      if(res && res.status === "success") { 
        showToast("Configuración guardada", "success"); 
        this.adminConfig = payload; 
        this.closeModalHelper("promoConfigModal"); 
      } else {
        throw new Error(res?.message || "Fallo al guardar la configuración.");
      }
    } catch (error) {
      console.error("Error en savePromoConfig:", error);
      showToast(`Error: ${error.message}`, "error");
    } finally {
      btn.innerText = "Guardar Anuncio"; 
      btn.disabled = false;
    }
  },

  openQRModal() { this.openModalHelper("qrModal"); this.renderAdminQR(); },
  
  handleQRImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { const img = new Image(); img.onload = () => { this.customQRLogo = img; this.renderAdminQR(); }; img.src = e.target.result; };
      reader.readAsDataURL(file);
    }
  },

  renderAdminQR() {
    const canvas = document.getElementById('admin-qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let baseUrl = document.getElementById('qr-input-url').value.trim() || "https://pietroflorian-collab.github.io/menu_sukidesu/";
    if(baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1); 
    
    const textoQR = document.getElementById('qr-input-texto')?.value.trim() || 'MENÚ';
    
    const hoy = new Date();
    const dia = hoy.getDate();
    const anio = hoy.getFullYear();
    const tokenSecreto = dia + (anio * 76); 
    
    const urlRastreo = `${baseUrl}/?mesa=${encodeURIComponent(textoQR.replace(/\s+/g, '_'))}&tk=${tokenSecreto}`;

    canvas.width = 292; canvas.height = 342;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(16, 16, 260, 260);
    
    if (typeof QRCode !== 'undefined') {
      QRCode.toDataURL(urlRastreo, { 
        width: 260, margin: 0, errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (err, url) => {
        if (err) return;
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 16, 16);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(106, 106, 80, 80); 
          if (this.customQRLogo) ctx.drawImage(this.customQRLogo, 114, 114, 64, 64);
          
          ctx.fillStyle = '#FFFFFF'; 
          ctx.font = 'bold 26px sans-serif'; 
          ctx.textAlign = 'center'; 
          ctx.fillText(textoQR.toUpperCase(), 146, 317);
        };
        qrImg.src = url;
      });
    }
  },

  downloadAdminQR() {
    const textoQR = document.getElementById('qr-input-texto')?.value.trim() || 'QR';
    const nombreLimpio = textoQR.replace(/\s+/g, '_'); 
    
    const link = document.createElement('a'); 
    link.download = `QR_${nombreLimpio}.png`; 
    link.href = document.getElementById('admin-qr-canvas').toDataURL(); 
    link.click();
  },

  populateCategorySelect() {
    const categoriasReales = this.adminCategories.filter(cat => {
      const name = (cat.nombre || "").toLowerCase();
      return name !== "combos y promo" && name !== "combos y promos";
    });
    document.getElementById("item-categoria").innerHTML = categoriasReales.map(cat => 
      `<option value="${escapeHTML(cat.nombre)}" class="bg-surface-container-high text-on-surface">${escapeHTML(cat.nombre)}</option>`
    ).join("");
  },

  setupAdminCategories() {
    if (this.adminCategories.length === 0) return;
    let categoriasVisibles = this.adminCategories.filter(c => {
        const name = (c.nombre || "").toLowerCase();
        return !name.includes("combo") && !name.includes("promo");
    });
    categoriasVisibles.push({ nombre: "Combos y Promo", es_pausada: false });

    if (!this.selectedCategory || !categoriasVisibles.some(c => c.nombre === this.selectedCategory)) {
      this.selectedCategory = categoriasVisibles[0].nombre;
    }

    document.getElementById("admin-category-bar").innerHTML = categoriasVisibles.map(cat => `
      <button data-category="${escapeHTML(cat.nombre)}" class="w-44 h-11 px-3 py-2 rounded-full font-label-bold text-sm shrink-0 transition-all ${cat.es_pausada ? 'opacity-50 grayscale border-dashed' : ''} ${this.selectedCategory === cat.nombre ? 'bg-primary text-sushi-white' : 'bg-surface-container-highest text-tertiary hover:bg-surface-bright'}">${escapeHTML(cat.nombre)} ${cat.es_pausada ? '⏸' : ''}</button>
    `).join("");
  },

  filterAdminCategory(cat) { this.selectedCategory = cat; this.setupAdminCategories(); this.renderAdminGrid(); },
  handleSearch(query) { this.searchQuery = query.toLowerCase().trim(); this.renderAdminGrid(); },

  renderAdminGrid() {
    const grid = document.getElementById("admin-grid");
    const filtered = this.adminItems.filter(i => {
      const safeName = i.nombre || "";
      const matchesSearch = !this.searchQuery || safeName.toLowerCase().includes(this.searchQuery);
      let matchesCategory = false;
      
      if (this.selectedCategory === "Combos y Promo") {
        const cat = (i.categoria || "").toLowerCase();
        matchesCategory = (
          cat === "combos" || cat === "promociones" || cat === "promos" || cat === "promo" ||
          (i.dias_promo && i.dias_promo.trim() !== "")
        );
      } else {
        matchesCategory = this.searchQuery ? true : (i.categoria === this.selectedCategory);
      }
      return matchesSearch && matchesCategory;
    });
    
    const itemsHTML = filtered.map(item => UI.generarTarjetaPlato(item, 'admin')).join("");
    const addCardHTML = `<div id="btn-add-grid" class="rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center min-h-[240px] cursor-pointer group"><div class="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors"><span class="material-symbols-outlined text-3xl">add</span></div><span class="font-label-bold text-tertiary group-hover:text-primary">Añadir Nuevo</span></div>`;
    
    grid.innerHTML = itemsHTML + addCardHTML;
    document.getElementById("btn-add-grid")?.addEventListener('click', () => this.openModal());
  },

  openCategoryModal() { this.renderCategoryManageList(); this.openModalHelper("categoryModal"); },

  renderCategoryManageList() {
    document.getElementById("category-manage-list").innerHTML = this.adminCategories.map(cat => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-high border border-outline-variant/30">
        <span class="font-label-bold text-sm ${cat.es_pausada ? 'line-through text-secondary' : 'text-on-surface'}">${escapeHTML(cat.nombre)}</span>
        <div class="flex gap-2">
          <button data-action="toggle-cat" data-id="${escapeHTML(cat.id)}" data-state="${!cat.es_pausada}" class="px-3 py-1 rounded text-xs font-label-bold ${cat.es_pausada ? 'bg-primary text-sushi-white' : 'bg-surface-variant text-secondary'}">${cat.es_pausada ? 'Reactivar' : 'Pausar'}</button>
          <button data-action="delete-cat" data-id="${escapeHTML(cat.id)}" class="p-1 text-error hover:bg-error/10 rounded"><span class="material-symbols-outlined pointer-events-none">delete</span></button>
        </div>
      </div>`).join("");
  },

  async handleCreateCategorySubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("add-cat-btn"); 
    btn.disabled = true; 
    btn.innerText = "Creando...";
    
    try {
      const res = await MenuAPI.createCategory({ nombre: document.getElementById("new-cat-name").value.trim() });
      if (res && res.status === "success") { 
        document.getElementById("new-cat-name").value = ""; 
        showToast("Categoría creada", "success"); 
        await this.loadAdminData(); 
        this.renderCategoryManageList(); 
      } else {
        throw new Error(res?.message || "La base de datos rechazó la categoría.");
      }
    } catch (error) {
      console.error("Error en handleCreateCategorySubmit:", error);
      showToast(`Error: ${error.message}`, "error");
    } finally {
      btn.disabled = false; 
      btn.innerText = "+ Crear";
    }
  },

  async toggleCategoryPause(id, esPausada) {
    try {
      const res = await MenuAPI.updateCategory({ id: id, es_pausada: esPausada });
      if (res && res.status === "success") { 
        showToast("Estado actualizado", "info"); 
        await this.loadAdminData(); 
        this.renderCategoryManageList(); 
      } else {
        throw new Error("No se pudo actualizar el estado de la categoría.");
      }
    } catch (error) {
      console.error("Error en toggleCategoryPause:", error);
      showToast(`Error: ${error.message}`, "error");
    }
  },

  async deleteCategory(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      const res = await MenuAPI.deleteCategory(id);
      if (res && res.status === "success") { 
        showToast("Eliminada", "success"); 
        await this.loadAdminData(); 
        this.renderCategoryManageList(); 
      } else {
        throw new Error("No se pudo eliminar la categoría desde Firestore.");
      }
    } catch (error) {
      console.error("Error en deleteCategory:", error);
      showToast(`Error: ${error.message}`, "error");
    }
  },

  updateModalPreview() {
    const itemEnVivo = {
      nombre: document.getElementById("item-nombre").value || "Nombre del Plato",
      categoria: document.getElementById("item-categoria").value || "Categoría",
      descripcion: document.getElementById("item-descripcion").value || "Descripción del plato...",
      precio: document.getElementById("item-precio").value || 0,
      imagen_url: document.getElementById("item-imagen-url").value || "",
      es_picante: document.getElementById("item-picante").checked,
      es_pausado: document.getElementById("item-pausado").checked,
      texto_promo: document.getElementById("item-promo-texto").value.trim()
    };

    const contenedor = document.getElementById("preview-container");
    if (contenedor && typeof UI !== 'undefined') {
      contenedor.innerHTML = UI.generarTarjetaPlato(itemEnVivo, 'preview');
    }
  },

  async togglePausado(id) {
    const item = this.adminItems.find(i => i.id == id);
    if (!item) return;
    item.es_pausado = !(String(item.es_pausado).toLowerCase() === "true");
    
    try {
      const res = await MenuAPI.updateItem(item);
      if (res && res.status === "success") { 
        showToast("Estado de plato actualizado", "info"); 
        this.renderAdminGrid(); 
      } else {
        throw new Error("Rechazado por la base de datos.");
      }
    } catch (error) {
      item.es_pausado = !item.es_pausado;
      console.error("Error en togglePausado:", error);
      showToast(`Error al pausar: ${error.message}`, "error");
    }
  },

  openModal(item = null) {
    document.getElementById("itemForm").reset();
    document.getElementById("item-id").value = item ? item.id : "";
    document.getElementById("item-file-input").value = "";
    this.pendingImageBase64 = null;
    document.getElementById("modal-title").innerText = item ? "Editar Plato" : "Añadir Nuevo Plato";
    document.querySelectorAll('input[name="promo-dia"]').forEach(cb => cb.checked = false);
    
    if (item) {
      document.getElementById("item-nombre").value = item.nombre || "";
      document.getElementById("item-precio").value = item.precio || 0;
      document.getElementById("item-categoria").value = item.categoria || "";
      document.getElementById("item-imagen-url").value = item.imagen_url || "";
      document.getElementById("item-descripcion").value = item.descripcion || "";
      document.getElementById("item-picante").checked = String(item.es_picante).toLowerCase() === "true";
      document.getElementById("item-pausado").checked = String(item.es_pausado).toLowerCase() === "true";
      document.getElementById("item-promo-texto").value = item.texto_promo || ""; 

      if (item.dias_promo) {
        const activeDays = item.dias_promo.split(',').map(d => d.trim());
        document.querySelectorAll('input[name="promo-dia"]').forEach(cb => { if (activeDays.includes(cb.value)) cb.checked = true; });
      }
    } else {
      document.getElementById("item-imagen-url").value = "";
    }
    
    this.updateModalPreview(); 
    this.openModalHelper("itemModal");
  },

  editItem(id) { const item = this.adminItems.find(i => i.id == id); if (item) this.openModal(item); },
  
  async deleteItem(id) { 
    if (!confirm("¿Borrar este plato?")) return;
    try {
      const res = await MenuAPI.deleteItem(id); 
      if (res && res.status === "success") { 
        showToast("Borrado exitosamente", "success"); 
        await this.loadAdminData(); 
      } else {
        throw new Error("No se pudo borrar el documento.");
      }
    } catch (error) {
      console.error("Error en deleteItem:", error);
      showToast(`Error: ${error.message}`, "error");
    }
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-btn"); 
    btn.disabled = true; 
    
    try {
      btn.innerText = "Subiendo imagen (GitHub)...";
      const finalImageUrl = await this.uploadToGitHub();

      btn.innerText = "Guardando datos...";
      const payload = {
        id: document.getElementById("item-id").value, 
        nombre: document.getElementById("item-nombre").value,
        precio: document.getElementById("item-precio").value, 
        categoria: document.getElementById("item-categoria").value,
        imagen_url: finalImageUrl, 
        descripcion: document.getElementById("item-descripcion").value,
        es_picante: document.getElementById("item-picante").checked, 
        es_pausado: document.getElementById("item-pausado").checked,
        texto_promo: document.getElementById("item-promo-texto").value.trim(),
        dias_promo: Array.from(document.querySelectorAll('input[name="promo-dia"]:checked')).map(cb => cb.value).join(',')
      };
      
      const res = payload.id ? await MenuAPI.updateItem(payload) : await MenuAPI.createItem(payload);
      if (res && res.status === "success") { 
        showToast("Plato guardado con éxito", "success"); 
        this.closeModalHelper("itemModal"); 
        await this.loadAdminData(); 
      } else {
        throw new Error(res?.message || "Error al procesar el registro en Firestore.");
      }
    } catch (error) {
      console.error("Error en handleFormSubmit:", error);
      showToast(`Error: ${error.message}`, "error");
    } finally {
      btn.disabled = false; 
      btn.innerText = "Guardar Plato";
    }
  }
};

document.addEventListener("DOMContentLoaded", () => AuthManager.init());