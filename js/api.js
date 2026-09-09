import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-bFjUVczmEyaEL_jRhmaKJIsuTleooIw",
  authDomain: "bdmenusukidesu2.firebaseapp.com",
  projectId: "bdmenusukidesu2",
  storageBucket: "bdmenusukidesu2.firebasestorage.app",
  messagingSenderId: "193702895694",
  appId: "1:193702895694:web:0a0083ea520096ddbc231f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[match]);
}

export function formatPrice(num) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num);
}

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-white font-bold z-[9999] transition-opacity duration-300 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

export const MenuAPI = {
  async fetchItems(isAdmin = false) {
    if (!isAdmin) {
      try {
        // El cliente lee desde el repositorio público de imágenes
        const res = await fetch(`https://raw.githubusercontent.com/sukidesumenu-svg/image_sukidesu/main/menu.json?v=${new Date().getTime()}`);
        if (!res.ok) throw new Error("Menú no publicado");
        return await res.json();
      } catch (error) {
        console.error("Error al cargar JSON público:", error);
        return { items: [], categories: [], config: {} };
      }
    }

    const items = [];
    const snap = await getDocs(collection(db, 'productos'));
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));

    const categories = [];
    const catSnap = await getDocs(collection(db, 'categorias'));
    catSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));

    let config = {};
    const confSnap = await getDoc(doc(db, 'sistema', 'configuracion'));
    if (confSnap.exists()) config = confSnap.data();

    return { items, categories, config };
  },
  
  async publishMenuJSON(token) {
    const data = await this.fetchItems(true);
    const jsonString = JSON.stringify(data);
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));
    
    // El administrador publica en el repositorio público de imágenes
    const repoPath = `sukidesumenu-svg/image_sukidesu`;
    const githubApiUrl = `https://api.github.com/repos/${repoPath}/contents/menu.json`;

    let sha = "";
    try {
      const resGet = await fetch(githubApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resGet.ok) {
        const fileData = await resGet.json();
        sha = fileData.sha;
      }
    } catch (e) {}

    const body = {
      message: `Compilacion Automatica del Menu JSON`,
      content: base64Content,
      branch: "main"
    };
    if (sha) body.sha = sha;

    const res = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Fallo al publicar JSON en GitHub");
    return { status: 'success' };
  },

  async createItem(data) {
    const ref = doc(collection(db, 'productos'));
    await setDoc(ref, data);
    return { status: 'success' };
  },
  async updateItem(data) {
    const ref = doc(db, 'productos', data.id);
    const { id, ...updateData } = data;
    await updateDoc(ref, updateData);
    return { status: 'success' };
  },
  async deleteItem(id) {
    await deleteDoc(doc(db, 'productos', id));
    return { status: 'success' };
  },
  async createCategory(data) {
    const ref = doc(collection(db, 'categorias'));
    await setDoc(ref, { ...data, es_pausada: false });
    return { status: 'success' };
  },
  async updateCategory(data) {
    await updateDoc(doc(db, 'categorias', data.id), { es_pausada: data.es_pausada });
    return { status: 'success' };
  },
  async deleteCategory(id) {
    await deleteDoc(doc(db, 'categorias', id));
    return { status: 'success' };
  },
  async updateConfig(data) {
    await setDoc(doc(db, 'sistema', 'configuracion'), data, { merge: true });
    return { status: 'success' };
  }
};