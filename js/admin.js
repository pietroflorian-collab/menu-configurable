import { auth, db, MenuAPI, escapeHTML, showToast } from './api.js';
import { UI } from './ui.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
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
          this.userRole = userSnap.exists() ? userSnap.data().rol : (user.uid === '6pgUHNjYxXOBd7GtYuChQEdg6tm2' ? 'superadmin' : null);
          
          if (this.userRole) { 
            loginOverlay.classList.add('hidden'); 
            if (adminLayout) adminLayout.classList.remove('hidden'); 
            SukidesuAdmin.init(); 
          } else { 
            throw new Error("Usuario sin roles asignados o revocado."); 
          }
        } catch (error) { 
          console.error(error); 
          showToast("Acceso denegado. Perfil revocado.", "error"); 
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
    
    btn.innerText = "Verificando..."; 
    btn.disabled = true;
    
    try { 
      await signInWithEmailAndPassword(auth, email, pass); 
    } catch (error) { 
      showToast("Credenciales inválidas", "error"); 
    } finally { 
      btn.innerText = "Ingresar"; 
      btn.disabled = false; 
    }
  },

  logout() { 
    signOut(auth).then(() => { 
      window.location.reload(); 
    }).catch((error) => { 
      console.error("Error al cerrar sesión", error); 
    }); 
  },

  async registrarEmpleado(email, pass, rolAsignado) {
    if (this.userRole === 'editor' || (this.userRole === 'administrador' && rolAsignado !== 'editor')) { 
      showToast("No tienes privilegios para crear este perfil", "error"); 
      return false; 
    }
    
    const secondaryApp = initializeApp(getApp().options, "WorkerApp"); 
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      await setDoc(doc(db, 'usuarios', res.user.uid), { rol: rolAsignado, email: email });
      showToast(`Perfil (${rolAsignado}) creado con éxito`, "success"); 
      return true;
    } catch (error) { 
      showToast(`Error al crear empleado: ${error.message}`, "error"); 
      return false; 
    } finally { 
      await deleteApp(secondaryApp); 
    }
  }
};

const SukidesuAdmin = {
  adminItems: [], 
  adminCategories: [], 
  adminConfig: {}, 
  selectedCategory: "", 
  searchQuery: "", 
  customQRLogo: null, 
  cropperInstance: null, 
  pendingImageBase64: null, 
  pendingConfirmAction: null,

  init() { 
    this.bindEvents(); 
    this.loadAdminData(); 
    this.enableDragScroll("admin-category-bar"); 
  },

  bindEvents() {
    const bindClick = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    
    // Disparadores de Publicación
    bindClick("nav-publish-btn", () => this.handlePublishMenu());
    bindClick("mobile-publish-btn", () => this.handlePublishMenu());

    bindClick("nav-promo-btn", () => this.openPromoModal()); 
    bindClick("nav-qr-btn", () => this.openQRModal()); 
    bindClick("nav-add-btn", () => this.openModal());
    bindClick("nav-cat-btn", () => this.openCategoryModal()); 
    bindClick("nav-emp-btn", () => this.openEmployeeModal()); 
    bindClick("nav-logout-btn", () => AuthManager.logout()); 
    bindClick("mobile-logout-btn", () => AuthManager.logout());
    
    bindClick("close-promo-btn", () => this.closeModalHelper("promoConfigModal")); 
    bindClick("close-qr-btn", () => this.closeModalHelper("qrModal"));
    bindClick("close-cat-btn", () => this.closeModalHelper("categoryModal")); 
    bindClick("close-item-btn", () => this.closeModalHelper("itemModal"));
    bindClick("cancel-item-btn", () => this.closeModalHelper("itemModal")); 
    bindClick("close-emp-btn", () => this.closeModalHelper("employeeModal"));
    bindClick("close-cropper-btn", () => this.cancelCrop()); 
    bindClick("cancel-cropper-btn", () => this.cancelCrop());
    bindClick("cancel-confirm-btn", () => this.closeConfirmDialog()); 
    bindClick("execute-confirm-btn", () => this.executeConfirmAction());
    
    bindClick("promo-save-btn", () => this.savePromoConfig()); 
    bindClick("qr-download-btn", () => this.downloadAdminQR()); 
    bindClick("confirm-crop-btn", () => this.confirmCrop());
    
    document.getElementById("admin-search-input")?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById("itemForm")?.addEventListener('submit', (e) => this.handleFormSubmit(e));
    document.getElementById("catForm")?.addEventListener('submit', (e) => this.handleCreateCategorySubmit(e));
    document.getElementById("empForm")?.addEventListener('submit', (e) => this.handleEmpSubmit(e));
    
    document.getElementById("qr-input-url")?.addEventListener('input', () => this.renderAdminQR());
    document.getElementById("qr-input-file")?.addEventListener('change', (e) => this.handleQRImageUpload(e));
    document.getElementById("qr-input-texto")?.addEventListener('input', () => this.renderAdminQR());
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
    
    document.getElementById("employee-list")?.addEventListener('click', (e) => { 
      const btn = e.target.closest('button[data-action="delete-emp"]'); 
      if (btn) this.revokeEmployee(btn.dataset.id); 
    });
  },

  async handlePublishMenu() {
    const config = await MenuAPI.getDeployConfig();
    const usados = config.despliegues_usados || 0;
    const restantes = 500 - usados;

    this.showConfirmDialog(
      "Publicar Menú en Vivo", 
      `¿Estás seguro de que ya realizaste TODOS los cambios necesarios en el menú?\n\nTe quedan ${restantes} actualizaciones en vivo este mes.\nAprovecha para agrupar los cambios antes de publicar.`, 
      async () => {
        const pcBtn = document.getElementById("nav-publish-btn");
        const mobBtn = document.getElementById("mobile-publish-btn");
        const originalPcText = pcBtn ? pcBtn.innerHTML : "";
        
        try {
          if (pcBtn) { pcBtn.innerHTML = `<span class="material-symbols-outlined mr-2 text-base animate-spin">sync</span> Publicando...`; pcBtn.disabled = true; }
          if (mobBtn) { mobBtn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">sync</span>`; mobBtn.disabled = true; }

          const secretSnap = await getDoc(doc(db, "sistema", "secretos"));
          if (!secretSnap.exists()) throw new Error("Token de acceso no encontrado.");
          
          const res = await MenuAPI.publishMenuJSON(secretSnap.data().token_github);
          
          if (res && res.status === 'success') {
            document.getElementById("pending-changes-banner")?.classList.add("hidden");
            if (this.adminConfig) this.adminConfig.cambios_pendientes = false;
            showToast("¡Menú publicado en vivo exitosamente!", "success");
          }
        } catch (error) {
          console.error("Error en publicación:", error);
          showToast(`Error: ${error.message}`, "error");
        } finally {
          if (pcBtn) { pcBtn.innerHTML = originalPcText; pcBtn.disabled = false; }
          if (mobBtn) { mobBtn.innerHTML = `<span class="material-symbols-outlined text-[18px] pointer-events-none">cloud_upload</span>`; mobBtn.disabled = false; }
        }
      }
    );
  },

  enableDragScroll(id) {
    const slider = document.getElementById(id); 
    if (!slider) return; 
    let isDown = false, startX, scrollLeft;
    
    slider.addEventListener('mousedown', (e) => { 
      isDown = true; 
      startX = e.pageX - slider.offsetLeft; 
      scrollLeft = slider.scrollLeft; 
    });
    slider.addEventListener('mouseleave', () => isDown = false); 
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => { 
      if (!isDown) return; 
      e.preventDefault(); 
      slider.scrollLeft = scrollLeft - ((e.pageX - slider.offsetLeft) - startX) * 2; 
    });
    slider.addEventListener('wheel', (e) => { 
      if (e.deltaY !== 0) { 
        e.preventDefault(); 
        slider.scrollLeft += e.deltaY; 
      } 
    }, { passive: false });
  },

  async loadAdminData() {
    document.getElementById("admin-loading").classList.remove("hidden"); 
    document.getElementById("admin-grid").classList.add("hidden");
    
    const res = await MenuAPI.fetchItems(true); 
    this.adminItems = res.items || []; 
    this.adminCategories = res.categories || []; 
    if (this.adminConfig.cambios_pendientes === true) {
      document.getElementById("pending-changes-banner")?.classList.remove("hidden");
    } else {
      document.getElementById("pending-changes-banner")?.classList.add("hidden");
    }
    
    document.getElementById("admin-loading").classList.add("hidden"); 
    document.getElementById("admin-grid").classList.remove("hidden");
    
    this.populateCategorySelect(); 
    this.setupAdminCategories(); 
    this.renderAdminGrid();
  },

  openModalHelper(id) { 
    document.getElementById(id)?.classList.replace("hidden", "flex"); 
  },
  
  closeModalHelper(id) { 
    document.getElementById(id)?.classList.replace("flex", "hidden"); 
  },

  showConfirmDialog(title, message, action) {
    document.getElementById('confirm-title').innerText = title; 
    document.getElementById('confirm-message').innerText = message;
    this.pendingConfirmAction = action; 
    this.openModalHelper('confirmModal');
  },
  
  closeConfirmDialog() { 
    this.closeModalHelper('confirmModal'); 
    this.pendingConfirmAction = null; 
  },
  
  executeConfirmAction() { 
    this.closeModalHelper('confirmModal'); 
    if (this.pendingConfirmAction) { 
      this.pendingConfirmAction(); 
      this.pendingConfirmAction = null; 
    } 
  },

  async openEmployeeModal() { 
    if (AuthManager.userRole === 'editor') { 
      showToast("Acceso denegado. Solo administradores.", "error"); 
      return; 
    } 
    this.openModalHelper("employeeModal"); 
    this.loadEmployees(); 
  },

  async loadEmployees() {
    const listContainer = document.getElementById("employee-list"); 
    listContainer.innerHTML = `<span class="text-secondary text-sm">Cargando personal...</span>`;
    
    try {
      const snap = await getDocs(collection(db, 'usuarios')); 
      const html = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data(); 
        if(docSnap.id === '6pgUHNjYxXOBd7GtYuChQEdg6tm2') return; 
        
        html.push(`
          <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-high border border-outline-variant/30">
            <div>
              <p class="font-label-bold text-sm text-on-surface">${escapeHTML(data.email || 'Sin correo registrado')}</p>
              <p class="text-xs text-primary uppercase">${escapeHTML(data.rol)}</p>
            </div>
            <button data-action="delete-emp" data-id="${docSnap.id}" class="p-2 text-error hover:bg-error/10 rounded transition-colors" title="Revocar Acceso">
              <span class="material-symbols-outlined pointer-events-none text-xl">person_remove</span>
            </button>
          </div>
        `);
      });
      
      listContainer.innerHTML = html.length > 0 ? html.join("") : `<span class="text-secondary text-sm">No hay empleados registrados.</span>`;
    } catch (error) { 
      listContainer.innerHTML = `<span class="text-error text-sm">Error al cargar personal.</span>`; 
    }
  },

  async handleEmpSubmit(e) {
    e.preventDefault(); 
    const btn = document.getElementById("submit-emp-btn"); 
    btn.disabled = true; 
    btn.innerText = "Procesando...";
    
    const success = await AuthManager.registrarEmpleado(
      document.getElementById("emp-email").value.trim(), 
      document.getElementById("emp-pass").value.trim(), 
      document.getElementById("emp-rol").value
    );
    
    if(success) { 
      document.getElementById("empForm").reset(); 
      this.loadEmployees(); 
    } 
    
    btn.disabled = false; 
    btn.innerText = "Crear Empleado";
  },

  async revokeEmployee(uid) {
    this.showConfirmDialog("Revocar Acceso", "¿Estás seguro de revocar permanentemente el acceso a este empleado? No podrá volver a ingresar al sistema.", async () => {
      try { 
        await deleteDoc(doc(db, 'usuarios', uid)); 
        showToast("Acceso revocado", "success"); 
        this.loadEmployees(); 
      } catch (error) { 
        showToast("Error al revocar acceso", "error"); 
      }
    });
  },

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
    
    const canvas = this.cropperInstance.getCroppedCanvas({ width: 600, height: 800 }); 
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
    if (!secretSnap.exists()) throw new Error("Token no encontrado.");
    
    const token = secretSnap.data().token_github; 
    const nombreArchivo = `plato_${Date.now()}.webp`; 
    const repoPath = `sukidesumenu-svg/image_sukidesu`;
    const githubApiUrl = `https://api.github.com/repos/${repoPath}/contents/assets/img/${nombreArchivo}`;
    
    const res = await fetch(githubApiUrl, { 
      method: 'PUT', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
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
    
    if (url) { 
      imgEl.src = url; 
      imgEl.classList.remove("hidden"); 
    } else { 
      imgEl.src = ""; 
      imgEl.classList.add("hidden"); 
    }
  },
  
  async savePromoConfig() {
    const btn = document.getElementById("promo-save-btn"); 
    btn.innerText = "Guardando..."; 
    btn.disabled = true;
    
    const payload = { 
      promo_activa: document.getElementById("config-promo-activa").checked.toString(), 
      promo_texto: document.getElementById("config-promo-texto").value, 
      promo_imagen: document.getElementById("config-promo-img").value 
    };
    
    try { 
      const res = await MenuAPI.updateConfig(payload); 
      if(res && res.status === "success") { 
        showToast("Configuración guardada", "success"); 
        document.getElementById("pending-changes-banner")?.classList.remove("hidden");
        this.adminConfig = payload; 
        this.closeModalHelper("promoConfigModal"); 
      } else { 
        throw new Error(res?.message || "Error al guardar"); 
      } 
    } catch (error) { 
      showToast(`Error: ${error.message}`, "error"); 
    } finally { 
      btn.innerText = "Guardar Anuncio"; 
      btn.disabled = false; 
    }
  },

  openQRModal() { 
    this.openModalHelper("qrModal"); 
    this.renderAdminQR(); 
  },
  
  handleQRImageUpload(event) { 
    const file = event.target.files[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onload = (e) => { 
        const img = new Image(); 
        img.onload = () => { 
          this.customQRLogo = img; 
          this.renderAdminQR(); 
        }; 
        img.src = e.target.result; 
      }; 
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
    const tokenSecreto = hoy.getDate() + (hoy.getFullYear() * 76); 
    const urlRastreo = `${baseUrl}/?mesa=${encodeURIComponent(textoQR.replace(/\s+/g, '_'))}&tk=${tokenSecreto}`;
    
    canvas.width = 292; 
    canvas.height = 342; 
    ctx.fillStyle = '#0a0a0a'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    ctx.fillStyle = '#FFFFFF'; 
    ctx.fillRect(16, 16, 260, 260);
    
    if (typeof QRCode !== 'undefined') { 
      QRCode.toDataURL(urlRastreo, { width: 260, margin: 0, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#FFFFFF' } }, (err, url) => { 
        if (err) return; 
        const qrImg = new Image(); 
        qrImg.onload = () => { 
          ctx.drawImage(qrImg, 16, 16); 
          ctx.fillStyle = '#FFFFFF'; 
          ctx.fillRect(106, 106, 80, 80); 
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
    const link = document.createElement('a'); 
    link.download = `QR_${(document.getElementById('qr-input-texto')?.value.trim() || 'QR').replace(/\s+/g, '_')}.png`; 
    link.href = document.getElementById('admin-qr-canvas').toDataURL(); 
    link.click(); 
  },

  populateCategorySelect() { 
    const categoriasReales = this.adminCategories.filter(cat => { 
      const name = (cat.nombre || "").toLowerCase(); 
      return name !== "combos y promo" && name !== "combos y promos"; 
    }); 
    document.getElementById("item-categoria").innerHTML = categoriasReales.map(cat => `<option value="${escapeHTML(cat.nombre)}" class="bg-surface-container-high text-on-surface">${escapeHTML(cat.nombre)}</option>`).join(""); 
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
    
    document.getElementById("admin-category-bar").innerHTML = categoriasVisibles.map(cat => `<button data-category="${escapeHTML(cat.nombre)}" class="w-44 h-11 px-3 py-2 rounded-full font-label-bold text-sm shrink-0 transition-all ${cat.es_pausada ? 'opacity-50 grayscale border-dashed' : ''} ${this.selectedCategory === cat.nombre ? 'bg-primary text-sushi-white' : 'bg-surface-container-highest text-tertiary hover:bg-surface-bright'}">${escapeHTML(cat.nombre)} ${cat.es_pausada ? '⏸' : ''}</button>`).join("");
  },
  
  filterAdminCategory(cat) { 
    this.selectedCategory = cat; 
    this.setupAdminCategories(); 
    this.renderAdminGrid(); 
  }, 
  
  handleSearch(query) { 
    this.searchQuery = query.toLowerCase().trim(); 
    this.renderAdminGrid(); 
  },

  renderAdminGrid() {
    const grid = document.getElementById("admin-grid");
    
    const filtered = this.adminItems.filter(i => { 
      const safeName = i.nombre || ""; 
      const matchesSearch = !this.searchQuery || safeName.toLowerCase().includes(this.searchQuery); 
      let matchesCategory = false; 
      
      if (this.selectedCategory === "Combos y Promo") { 
        const cat = (i.categoria || "").toLowerCase(); 
        matchesCategory = (cat === "combos" || cat === "promociones" || cat === "promos" || cat === "promo" || (i.dias_promo && i.dias_promo.trim() !== "")); 
      } else { 
        matchesCategory = this.searchQuery ? true : (i.categoria === this.selectedCategory); 
      } 
      
      return matchesSearch && matchesCategory; 
    });
    
    const itemsHTML = filtered.map(item => UI.generarTarjetaPlato(item, 'admin')).join(""); 
    grid.innerHTML = itemsHTML + `<div id="btn-add-grid" class="rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center min-h-[240px] cursor-pointer group"><div class="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors"><span class="material-symbols-outlined text-3xl">add</span></div><span class="font-label-bold text-tertiary group-hover:text-primary">Añadir Nuevo</span></div>`;
    document.getElementById("btn-add-grid")?.addEventListener('click', () => this.openModal());
  },

  openCategoryModal() { 
    this.renderCategoryManageList(); 
    this.openModalHelper("categoryModal"); 
  },
  
  renderCategoryManageList() {
    document.getElementById("category-manage-list").innerHTML = this.adminCategories.map(cat => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-high border border-outline-variant/30">
        <span class="font-label-bold text-sm ${cat.es_pausada ? 'line-through text-secondary' : 'text-on-surface'}">${escapeHTML(cat.nombre)}</span>
        <div class="flex gap-2">
          <button data-action="toggle-cat" data-id="${escapeHTML(cat.id)}" data-state="${!cat.es_pausada}" class="px-3 py-1 rounded text-xs font-label-bold ${cat.es_pausada ? 'bg-primary text-sushi-white' : 'bg-surface-variant text-secondary'}">${cat.es_pausada ? 'Reactivar' : 'Pausar'}</button>
          <button data-action="delete-cat" data-id="${escapeHTML(cat.id)}" class="p-1 text-error hover:bg-error/10 rounded"><span class="material-symbols-outlined pointer-events-none">delete</span></button>
        </div>
      </div>
    `).join("");
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
        document.getElementById("pending-changes-banner")?.classList.remove("hidden");
        await this.loadAdminData(); 
        this.renderCategoryManageList(); 
      } else { 
        throw new Error(res?.message || "Rechazado por la BD."); 
      } 
    } catch (error) { 
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
        document.getElementById("pending-changes-banner")?.classList.remove("hidden");
        await this.loadAdminData(); 
        this.renderCategoryManageList(); 
      } 
    } catch (error) { 
      showToast(`Error: ${error.message}`, "error"); 
    } 
  },
  
  async deleteCategory(id) {
    this.showConfirmDialog("Eliminar Categoría", "Esta acción es irreversible y podría afectar los platos que tengan esta categoría asignada.", async () => {
      try { 
        const res = await MenuAPI.deleteCategory(id); 
        if (res && res.status === "success") { 
          showToast("Eliminada", "success"); 
          document.getElementById("pending-changes-banner")?.classList.remove("hidden");
          await this.loadAdminData(); 
          this.renderCategoryManageList(); 
        } 
      } catch (error) { 
        showToast(`Error: ${error.message}`, "error"); 
      }
    });
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
    if (contenedor && typeof UI !== 'undefined') contenedor.innerHTML = UI.generarTarjetaPlato(itemEnVivo, 'preview');
  },
  
  async togglePausado(id) {
    const item = this.adminItems.find(i => i.id == id); 
    if (!item) return; 
    
    item.es_pausado = !(String(item.es_pausado).toLowerCase() === "true");
    try { 
      const res = await MenuAPI.updateItem(item); 
      if (res && res.status === "success") { 
        showToast("Estado actualizado", "info"); 
        document.getElementById("pending-changes-banner")?.classList.remove("hidden");
        this.renderAdminGrid(); 
      } else throw new Error("Rechazado"); 
    } catch (error) { 
      item.es_pausado = !item.es_pausado; 
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
        document.querySelectorAll('input[name="promo-dia"]').forEach(cb => { 
          if (activeDays.includes(cb.value)) cb.checked = true; 
        }); 
      }
    } else { 
      document.getElementById("item-imagen-url").value = ""; 
    } 
    
    this.updateModalPreview(); 
    this.openModalHelper("itemModal");
  },
  
  editItem(id) { 
    const item = this.adminItems.find(i => i.id == id); 
    if (item) this.openModal(item); 
  },
  
  async deleteItem(id) { 
    this.showConfirmDialog("Eliminar Plato", "¿Estás seguro? Esta acción borrará el plato y la imagen del del Menú de forma permanente.", async () => {
      try { 
        const item = this.adminItems.find(i => i.id == id);
        if (item && item.imagen_url && item.imagen_url.includes('githubusercontent')) {
          try {
            const secretSnap = await getDoc(doc(db, "sistema", "secretos"));
            if (secretSnap.exists()) {
              const token = secretSnap.data().token_github; 
              const urlParts = item.imagen_url.split('/'); 
              const nombreArchivo = urlParts[urlParts.length - 1]; 
              const repoPath = `sukidesumenu-svg/image_sukidesu`; 
              const githubApiUrl = `https://api.github.com/repos/${repoPath}/contents/assets/img/${nombreArchivo}`;
              
              const resGet = await fetch(githubApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
              
              if (resGet.ok) { 
                const fileData = await resGet.json(); 
                await fetch(githubApiUrl, { 
                  method: 'DELETE', 
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ message: `Borrar imagen de plato eliminado: ${nombreArchivo}`, sha: fileData.sha, branch: "main" }) 
                }); 
              }
            }
          } catch (e) { 
            console.warn("Fallo silencioso al borrar imagen en GitHub:", e); 
          }
        }
        
        const res = await MenuAPI.deleteItem(id); 
        if (res && res.status === "success") { 
          showToast("Plato e imagen eliminados", "success"); 
          document.getElementById("pending-changes-banner")?.classList.remove("hidden");
          await this.loadAdminData(); 
        } else { 
          throw new Error("No se pudo borrar el documento."); 
        }
      } catch (error) { 
        console.error("Error en deleteItem:", error); 
        showToast(`Error: ${error.message}`, "error"); 
      }
    });
  },

  async handleFormSubmit(e) {
    e.preventDefault(); 
    const btn = document.getElementById("submit-btn"); 
    btn.disabled = true; 
    
    try {
      btn.innerText = "Subiendo imagen..."; 
      const finalImageUrl = await this.uploadToGitHub(); 
      btn.innerText = "Guardando datos...";
      
      const itemId = document.getElementById("item-id").value;
      const payload = {
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
      
      if (itemId) { payload.id = itemId; }
      
      const res = itemId ? await MenuAPI.updateItem(payload) : await MenuAPI.createItem(payload);
      
      if (res && res.status === "success") { 
        showToast("Plato guardado con éxito", "success"); 
        document.getElementById("pending-changes-banner")?.classList.remove("hidden");
        this.closeModalHelper("itemModal"); 
        await this.loadAdminData(); 
      } else { 
        throw new Error(res?.message || "Error en Firestore."); 
      }
    } catch (error) { 
      console.error("Error al guardar:", error); 
      showToast(`Error: ${error.message}`, "error"); 
    } finally { 
      btn.disabled = false; 
      btn.innerText = "Guardar Plato"; 
    }
  }
};

document.addEventListener("DOMContentLoaded", () => AuthManager.init());
