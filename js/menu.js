import { MenuAPI, escapeHTML, showToast } from './api.js';
import { UI } from './ui.js';

const SukidesuMenu = {
  allItems: [], categoriesList: [], config: {}, selectedCategory: "", STORAGE_KEY: "sukidesu_order_selection",

  getSelection() { try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; } catch (e) { return []; } },
  saveSelection(list) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list)); this.updateUI(); },
  toggleSelection(itemId, itemNombre) { let list = this.getSelection(); const index = list.findIndex(i => i.id === itemId); if (index >= 0) list.splice(index, 1); else list.push({ id: itemId, nombre: itemNombre, cantidad: 1 }); this.saveSelection(list); this.renderMenu(); },
  updateQuantity(itemId, delta) { let list = this.getSelection(); const item = list.find(i => i.id === itemId); if (item) { item.cantidad += delta; if (item.cantidad <= 0) list = list.filter(i => i.id !== itemId); this.saveSelection(list); this.renderMenu(); } },
  clearList() { localStorage.removeItem(this.STORAGE_KEY); this.updateUI(); this.renderMenu(); },
  openModal() { document.getElementById("order-modal").classList.remove("hidden"); },
  closeModal() { document.getElementById("order-modal").classList.add("hidden"); },

  // ---------- MOTOR DE APARIENCIA ----------
  aplicarTema(tema) {
    if (!tema) return;

    const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const val = (v) => {
      if (!v) return null;
      const s = String(v).trim();
      return HEX.test(s) ? s : null;
    };

    const colorPrimario   = val(tema.colorPrimario);
    const colorFondo      = val(tema.colorFondo);
    const colorTexto      = val(tema.colorTexto);
    const colorTextoSuave = val(tema.colorTextoSuave);
    const colorTarjetas   = val(tema.colorTarjetas);
    const colorCarrito    = val(tema.colorCarrito);
    const colorBordes     = val(tema.colorBordes);
    const colorAcento     = val(tema.colorAcento);
    const colorSubtitulo  = val(tema.colorSubtitulo);
    const colorHover      = val(tema.colorHover);

    if (colorPrimario || colorFondo || colorTexto || colorTextoSuave ||
        colorTarjetas || colorCarrito || colorBordes || colorAcento ||
        colorSubtitulo || colorHover) {
      let styleEl = document.getElementById('dynamic-theme');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-theme';
        document.head.appendChild(styleEl);
      }

      let css = ':root {\n';
      if (colorPrimario) {
        css += `  --color-primary: ${colorPrimario};\n`;
        css += `  --color-primary-fixed: ${colorPrimario};\n`;
        css += `  --color-primary-container: ${colorPrimario};\n`;
        css += `  --color-error: ${colorPrimario};\n`;
      }
      if (colorFondo) {
        css += `  --color-surface: ${colorFondo};\n`;
        css += `  --color-surface-container-lowest: ${colorFondo};\n`;
      }
      if (colorTexto) {
        css += `  --color-on-surface: ${colorTexto};\n`;
        css += `  --color-sushi-white: ${colorTexto};\n`;
      }
      if (colorTextoSuave) {
        css += `  --color-on-surface-variant: ${colorTextoSuave};\n`;
        css += `  --color-tertiary: ${colorTextoSuave};\n`;
      }
      if (colorTarjetas) { css += `  --color-surface-container-low: ${colorTarjetas};\n`; }
      if (colorCarrito) { css += `  --color-surface-container-high: ${colorCarrito};\n`; }
      if (colorBordes) { css += `  --color-outline-variant: ${colorBordes};\n`; }
      if (colorAcento) { css += `  --color-wasabi-green: ${colorAcento};\n`; }
      if (colorSubtitulo) { css += `  --color-secondary-fixed: ${colorSubtitulo};\n`; }
      if (colorHover) { css += `  --color-surface-bright: ${colorHover};\n`; }
      css += '}';
      styleEl.textContent = css;
    }

    // ---------- TIPOGRAFÍA (27 zonas) ----------
    const zonas = [
      'nav-negocio','nav-link','hero-eslogan','hero-descripcion',
      'cat-titulo','cat-boton','plato-nombre','plato-precio','plato-descripcion',
      'plato-tag','plato-promo','plato-picante','plato-foto',
      'modal-titulo','modal-item','modal-cantidad','modal-botones','modal-vacio',
      'fab-texto','fab-badge','mant-titulo','mant-descripcion',
      'promo-texto','promo-botones','footer-texto','footer-links','toast'
    ];

    zonas.forEach((z) => {
      const fKey = 'fuente' + z.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
      const sKey = 'tamaño' + z.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
      const fuente = tema[fKey];
      const tamaño = tema[sKey];
      if (fuente) this.aplicarFuente(z, fuente);
      if (tamaño !== undefined && tamaño !== null && tamaño !== '') {
        const n = parseFloat(String(tamaño).replace(/[^\d.]/g, ''));
        if (!isNaN(n) && n >= 8 && n <= 120) {
          document.documentElement.style.setProperty(`--size-${z}`, n + 'px');
        }
      }
    });

    // ---------- RADIOS ----------
    const radio = tema.radioBordes;
    if (radio !== undefined && radio !== null && radio !== '') {
      const n = parseFloat(String(radio).replace(/[^\d.]/g, ''));
      if (!isNaN(n) && n >= 0 && n <= 48) {
        document.documentElement.style.setProperty('--dynamic-radius-lg', n + 'px');
        document.documentElement.style.setProperty('--dynamic-radius-xl', (n * 1.5) + 'px');
        document.documentElement.style.setProperty('--dynamic-radius-2xl', (n * 2) + 'px');
      }
    }
  },

  aplicarFuente(zona, nombre) {
    if (!nombre || typeof nombre !== 'string') return;
    const clean = nombre.trim();
    if (!/^[a-zA-Z0-9\s\-]+$/.test(clean) || clean.length > 60) return;

    const param = clean.replace(/\s+/g, '+');
    const url = `https://fonts.googleapis.com/css2?family=${param}:wght@400;700;800&display=swap`;

    const id = `dynamic-font-${zona}`;
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== url) link.setAttribute('href', url);

    document.documentElement.style.setProperty(
      `--font-${zona}`,
      `"${clean}", system-ui, -apple-system, sans-serif`
    );
  },

  updateUI() {
    const list = this.getSelection(); const totalCount = list.reduce((acc, curr) => acc + curr.cantidad, 0); const fabContainer = document.getElementById("fab-container");
    if (totalCount > 0 && fabContainer) { fabContainer.classList.remove("hidden"); document.getElementById("fab-badge").innerText = totalCount; } else if (fabContainer) { fabContainer.classList.add("hidden"); this.closeModal(); }
    const modalList = document.getElementById("modal-item-list"); if (!modalList) return;
    if (list.length === 0) {
      modalList.innerHTML = `<div class="text-center py-8"><span class="material-symbols-outlined text-secondary text-4xl mb-2">remove_shopping_cart</span><p class="font-modal-vacio size-modal-vacio text-secondary">No has agregado platos a tu lista.</p></div>`;
    } else {
      modalList.innerHTML = list.map(item => `<div class="flex items-center justify-between bg-surface-container-high p-3 rounded-lg border border-outline-20"><span class="font-modal-item size-modal-item text-sushi-white truncate max-w-[60%]">${escapeHTML(item.nombre)}</span><div class="flex items-center gap-2 bg-black border border-outline-40 rounded-lg px-2 py-1"><button data-action="decrease" data-id="${escapeHTML(item.id)}" class="w-6 h-6 text-primary font-bold hover:bg-surface-variant rounded">-</button><span class="font-modal-cantidad size-modal-cantidad text-sushi-white px-1">${item.cantidad}</span><button data-action="increase" data-id="${escapeHTML(item.id)}" class="w-6 h-6 text-wasabi-green font-bold hover:bg-surface-variant rounded">+</button></div></div>`).join("");
    }
  },

  async init() {
    this.bindEvents();
    try {
      const data = await MenuAPI.fetchItems();
      this.config = data.config || {};
      this.tema = data.tema || {};
      this.aplicarTema(this.tema);

      if (this.config.estado_servicio && String(this.config.estado_servicio).toLowerCase() === "suspendido") {
        document.getElementById("maintenance-overlay").classList.replace("hidden", "flex");
        document.getElementById("loading-spinner")?.classList.add("hidden");
        return;
      }

      this.allItems = data.items || [];
      this.categoriesList = data.categories || [];
      localStorage.setItem('sukidesu_client_cache', JSON.stringify(data));
    } catch (e) {
      document.getElementById("loading-spinner")?.classList.add("hidden");
      const grid = document.getElementById("menu-grid");
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-12 px-4 bg-surface-container rounded-xl border border-dashed border-error/50 my-4 flex flex-col items-center">
            <span class="material-symbols-outlined text-error text-5xl mb-3">wifi_off</span>
            <h3 class="font-plato-nombre size-plato-nombre text-on-surface">Problemas de conexión</h3>
            <p class="font-plato-descripcion size-plato-descripcion text-secondary mt-1 mb-4">No pudimos cargar el menú desde el servidor. Revisa tu señal de internet.</p>
            <button id="btn-retry-fetch" class="bg-primary text-on-primary px-6 py-2 rounded-full font-cat-boton size-cat-boton flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all">
              <span class="material-symbols-outlined">refresh</span> Reintentar
            </button>
          </div>
        `;
        grid.classList.remove("hidden");
        document.getElementById("btn-retry-fetch")?.addEventListener("click", () => {
          grid.innerHTML = "";
          grid.classList.add("hidden");
          document.getElementById("loading-spinner")?.classList.remove("hidden");
          this.init();
        }, { once: true });
      }
      return;
    }

    document.getElementById("loading-spinner")?.classList.add("hidden");
    document.getElementById("menu-grid")?.classList.remove("hidden");
    this.setupCategoryFilter();
    this.renderMenu();
    this.updateUI();
    this.mostrarPromoFrontal(this.config);
    this.iniciarSincronizacionEnVivo();
  },

  iniciarSincronizacionEnVivo() {
    setInterval(async () => {
      try {
        const newData = await MenuAPI.fetchItems();
        if (!newData || !newData.items) return;
        const hashActual = JSON.stringify(this.allItems);
        const hashNuevo = JSON.stringify(newData.items);
        if (hashActual !== hashNuevo) {
          this.allItems = newData.items;
          this.categoriesList = newData.categories || [];
          this.config = newData.config || {};
          this.tema = newData.tema || {};
          this.aplicarTema(this.tema);
          this.setupCategoryFilter();
          this.renderMenu();
          if (typeof showToast === "function") showToast("Menú actualizado en tiempo real", "info");
        }
      } catch (e) {
        console.error("Sincronización en segundo plano falló:", e);
      }
    }, 180000);
  },

  bindEvents() {
    const bindClick = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    bindClick("btn-open-cart", () => this.openModal()); bindClick("btn-close-cart", () => this.closeModal()); bindClick("btn-clear-cart", () => this.clearList()); bindClick("btn-close-cart-bottom", () => this.closeModal());
    document.getElementById("category-bar")?.addEventListener('click', (e) => { const btn = e.target.closest('button[data-category]'); if (btn) this.filterCategory(btn.dataset.category); });
    document.getElementById("menu-grid")?.addEventListener('click', (e) => { if (e.target.dataset.expandable) e.target.classList.toggle('line-clamp-3'); const btn = e.target.closest('button[data-action="toggle-select"]'); if (btn) this.toggleSelection(btn.dataset.id, btn.dataset.name); });
    document.getElementById("modal-item-list")?.addEventListener('click', (e) => { const btn = e.target.closest('button[data-action]'); if (!btn) return; if (btn.dataset.action === 'decrease') this.updateQuantity(btn.dataset.id, -1); if (btn.dataset.action === 'increase') this.updateQuantity(btn.dataset.id, 1); });
  },

  setupCategoryFilter() {
    if (this.categoriesList.length === 0) { document.getElementById("category-bar").innerHTML = `<p class="font-cat-boton size-cat-boton text-secondary">No hay categorías disponibles.</p>`; return; }
    let categoriasVisibles = this.categoriesList.filter(c => { const name = (c.nombre || "").toLowerCase(); return !name.includes("combo") && !name.includes("promo"); }).map(c => c.nombre); categoriasVisibles.push("Combos y Promo");
    if (!this.selectedCategory || !categoriasVisibles.includes(this.selectedCategory)) { this.selectedCategory = categoriasVisibles[0]; }
    const categoryBar = document.getElementById("category-bar");
    categoryBar.innerHTML = categoriasVisibles.map(cat => `<button data-category="${escapeHTML(cat)}" class="w-[145px] h-10 px-2 py-1 rounded-full font-cat-boton size-cat-boton text-center flex items-center justify-center shrink-0 transition-all ${this.selectedCategory === cat ? 'bg-primary-container text-sushi-white font-bold shadow-md' : 'bg-surface-container-highest text-tertiary hover:bg-surface-bright border border-outline-20'}">${escapeHTML(cat)}</button>`).join("");
    const titleEl = document.getElementById("current-category-title");
    if (titleEl) titleEl.innerHTML = `<span class="material-symbols-outlined mr-2 text-primary">restaurant_menu</span> ${escapeHTML(this.selectedCategory)}`;
  },

  renderMenu() {
    const grid = document.getElementById("menu-grid"); if (!grid) return;
    const rawToday = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long' }).toLowerCase();
    const today = rawToday.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const filtered = this.allItems.filter(i => {
      const cat = (i.categoria || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const activeDays = i.dias_promo ? i.dias_promo.split(',').map(d => d.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) : [];
      const isPromoToday = activeDays.some(d => d.startsWith(today) || today.startsWith(d));
      if (this.selectedCategory === "Combos y Promo") {
        if (cat === "combos" || cat === "combo") return true;
        if (isPromoToday) return true;
        return false;
      }
      return i.categoria === this.selectedCategory;
    });
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 bg-surface-container rounded-xl border border-dashed border-outline-30 my-4"><span class="material-symbols-outlined text-secondary text-5xl mb-3">ramen_dining</span><h3 class="font-plato-nombre size-plato-nombre text-secondary">No hay platos disponibles</h3><p class="font-plato-descripcion size-plato-descripcion text-secondary/70 mt-1">Pronto añadiremos nuevas opciones.</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(item => UI.generarTarjetaPlato(item, 'client', this.getSelection())).join("");
  },

  filterCategory(cat) { this.selectedCategory = cat; this.setupCategoryFilter(); this.renderMenu(); },

  mostrarPromoFrontal(config) {
    if (!config) return;
    const isActiva = String(config.promo_activa).toLowerCase() === "true";
    const texto = config.promo_texto || "";
    const imagenUrl = config.promo_imagen || "";
    if (!isActiva || texto.trim() === "") return;
    const modal = document.getElementById("clientePromoModal");
    const modalContent = document.getElementById("clientePromoContent");
    if (!modal || !modalContent) return;
    document.getElementById("cliente-promo-texto").innerText = texto;
    const imgElement = document.getElementById("cliente-promo-img");
    if (imagenUrl) { imgElement.src = imagenUrl; imgElement.classList.remove("hidden"); } else { imgElement.classList.add("hidden"); }
    modal.classList.replace("hidden", "flex");
    setTimeout(() => { modal.classList.remove("opacity-0"); modalContent.classList.remove("scale-95"); }, 50);
    const cerrarPromo = () => { modal.classList.add("opacity-0"); modalContent.classList.add("scale-95"); setTimeout(() => modal.classList.replace("flex", "hidden"), 300); };
    document.getElementById("close-cliente-promo").onclick = cerrarPromo;
    document.getElementById("btn-entendido-promo").onclick = cerrarPromo;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  SukidesuMenu.init();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registration) => { console.log('ServiceWorker registrado con éxito bajo el alcance: ', registration.scope); })
        .catch((error) => { console.error('Fallo en el registro del ServiceWorker: ', error); });
    });
  }
});