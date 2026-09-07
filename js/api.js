function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatPrice(price) {
  const amount = parseFloat(price) || 0;
  return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  let bgColor = type === 'success' ? 'bg-[#122419] border-wasabi-green/40 text-white' : 'bg-[#2a1215] border-error/40 text-white';
  let icon = type === 'success' ? 'check_circle' : 'error';
  let iconColor = type === 'success' ? 'text-wasabi-green' : 'text-error';

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-sm ${bgColor}`;
  toast.innerHTML = `<span class="material-symbols-outlined ${iconColor} text-xl shrink-0">${icon}</span><span class="font-body-md text-xs sm:text-sm flex-grow">${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Configuración de Firebase con tus llaves
const firebaseConfig = {
  apiKey: "AIzaSyDbZpP9gVLN3ZHlIMV9_1suAOm6ta0lmRU",
  authDomain: "bdmenusukidesu.firebaseapp.com",
  projectId: "bdmenusukidesu",
  storageBucket: "bdmenusukidesu.firebasestorage.app",
  messagingSenderId: "633626125351",
  appId: "1:633626125351:web:fa255734fe854d0c9c5a02"
};

// Inicialización de la base de datos
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const MenuAPI = {
  
  // ==========================================
  // COMPILADOR HÍBRIDO (El secreto del costo $0)
  // ==========================================
  async compilePublicMenu() {
    try {
      console.log("Compilando nuevo paquete público...");
      // 1. Recolectar toda la información granular
      const prodSnap = await db.collection("productos").get();
      const items = prodSnap.docs.map(doc => doc.data());
      const catSnap = await db.collection("categorias").get();
      const categories = catSnap.docs.map(doc => doc.data());
      const configDoc = await db.collection("sistema").doc("configuracion").get();
      const config = configDoc.exists ? configDoc.data() : {};

      const publicData = { items, categories, config };

      // 2. Escribir el documento único
      await db.collection("sistema").doc("menu_publico").set(publicData);
      
      // 3. Sellar la versión con la marca de tiempo (Milisegundos)
      const timestamp = new Date().getTime();
      await db.collection("sistema").doc("version").set({ v: timestamp });
      
      return true;
    } catch (e) {
      console.error("Fallo crítico en el compilador:", e);
      return false;
    }
  },

  // ==========================================
  // LECTOR INTELIGENTE
  // ==========================================
  async fetchItems(isAdmin = false) {
    if (isAdmin) {
      // Flujo Administrador: Lee carpetas separadas para poder editar sin colisiones
      try {
        const prodSnap = await db.collection("productos").get();
        const items = prodSnap.docs.map(doc => doc.data());
        const catSnap = await db.collection("categorias").get();
        const categories = catSnap.docs.map(doc => doc.data());
        const configDoc = await db.collection("sistema").doc("configuracion").get();
        const config = configDoc.exists ? configDoc.data() : {};
        return { items, categories, config };
      } catch (error) {
        showToast("Error leyendo base de datos", "error");
        return { items: [], categories: [], config: {} };
      }
    } else {
      // Flujo Cliente: Validador de Versiones
      try {
        const versionDoc = await db.collection("sistema").doc("version").get();
        const nubeVersion = versionDoc.exists ? versionDoc.data().v : 0;
        const localVersion = localStorage.getItem('sukidesu_version');

        // Si la versión del teléfono es igual a la de la nube, aborta conexión y usa memoria
        if (localVersion && nubeVersion.toString() === localVersion) {
          const cachedData = localStorage.getItem('sukidesu_menu_publico');
          if (cachedData) return JSON.parse(cachedData);
        }

        // Si la versión cambió, descarga 1 solo documento consolidado
        const menuDoc = await db.collection("sistema").doc("menu_publico").get();
        const freshData = menuDoc.exists ? menuDoc.data() : { items: [], categories: [], config: {} };
        
        // Actualiza el teléfono con los datos frescos
        localStorage.setItem('sukidesu_version', nubeVersion.toString());
        localStorage.setItem('sukidesu_menu_publico', JSON.stringify(freshData));
        
        return freshData;
      } catch (error) {
        return { items: [], categories: [], config: {} };
      }
    }
  },

  // ==========================================
  // OPERACIONES DE ESCRITURA (Con Autocompilación)
  // ==========================================
  async createItem(itemData) {
    try {
      const docRef = db.collection("productos").doc();
      itemData.id = docRef.id;
      await docRef.set(itemData);
      await this.compilePublicMenu(); 
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async updateItem(itemData) {
    try {
      await db.collection("productos").doc(itemData.id).update(itemData);
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async deleteItem(id) {
    try {
      await db.collection("productos").doc(id).delete();
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async createCategory(catData) {
    try {
      const docRef = db.collection("categorias").doc();
      catData.id = docRef.id;
      catData.es_pausada = false;
      await docRef.set(catData);
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async updateCategory(catData) {
    try {
      await db.collection("categorias").doc(catData.id).update({ es_pausada: catData.es_pausada });
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async deleteCategory(id) {
    try {
      await db.collection("categorias").doc(id).delete();
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  },

  async updateConfig(configData) {
    try {
      await db.collection("sistema").doc("configuracion").set(configData, { merge: true });
      await this.compilePublicMenu();
      return { status: "success" };
    } catch (error) { return { status: "error", message: error.message }; }
  }
};