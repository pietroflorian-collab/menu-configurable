import { db } from './api.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const ImageUploader = {
  cropperInstance: null,
  pendingImageBase64: null,
  pendingPromoImageBase64: null,
  cropTarget: 'item', // 'item' o 'promo'

  init() {
    // Escucha los cambios en los inputs de archivos para ambos modales
    document.getElementById("item-file-input")?.addEventListener('change', (e) => this.handleImageUpload(e, 'item'));
    document.getElementById("config-promo-file")?.addEventListener('change', (e) => this.handleImageUpload(e, 'promo'));
    
    // Botones del modal de recorte
    document.getElementById("close-cropper-btn")?.addEventListener('click', () => this.cancelCrop());
    document.getElementById("cancel-cropper-btn")?.addEventListener('click', () => this.cancelCrop());
    document.getElementById("confirm-crop-btn")?.addEventListener('click', () => this.confirmCrop());
  },

  handleImageUpload(event, target) {
    const file = event.target.files[0]; 
    if (!file) return; 
    
    this.cropTarget = target; 
    const reader = new FileReader();
    
    reader.onload = (e) => { 
      const imgElement = document.getElementById('cropper-image'); 
      if (!imgElement) return;
      
      imgElement.src = e.target.result; 
      
      // Abre el modal de Cropper
      document.getElementById('cropperModal')?.classList.replace("hidden", "flex");
      
      if (this.cropperInstance) this.cropperInstance.destroy(); 
      
      // Proporción: 512x192 para promo (~2.66), 3:4 para platos
      const ratio = this.cropTarget === 'promo' ? (512 / 192) : (3 / 4);
      
      setTimeout(() => { 
        imgElement.classList.remove("opacity-0"); 
        this.cropperInstance = new Cropper(imgElement, { 
          aspectRatio: ratio, 
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
    document.getElementById('cropperModal')?.classList.replace("flex", "hidden"); 
    const itemInput = document.getElementById('item-file-input');
    const promoInput = document.getElementById('config-promo-file');
    if (itemInput) itemInput.value = ""; 
    if (promoInput) promoInput.value = ""; 
    document.getElementById('cropper-image')?.classList.add("opacity-0"); 
  },
  
  confirmCrop(updateModalPreviewCallback, updatePromoPreviewCallback) {
    if (!this.cropperInstance) return; 
    
    const cropWidth = this.cropTarget === 'promo' ? 512 : 600;
    const cropHeight = this.cropTarget === 'promo' ? 192 : 800;
    
    const canvas = this.cropperInstance.getCroppedCanvas({ width: cropWidth, height: cropHeight }); 
    const base64Url = canvas.toDataURL('image/webp', 0.8);
    const base64Data = base64Url.split(',')[1];
    
    if (this.cropTarget === 'promo') {
      this.pendingPromoImageBase64 = base64Data;
      document.getElementById("config-promo-img").value = base64Url; 
      if (updatePromoPreviewCallback) updatePromoPreviewCallback();
    } else {
      this.pendingImageBase64 = base64Data;
      document.getElementById("item-imagen-url").value = base64Url; 
      if (updateModalPreviewCallback) updateModalPreviewCallback();
    }

    document.getElementById('cropperModal')?.classList.replace("flex", "hidden"); 
    document.getElementById('cropper-image')?.classList.add("opacity-0");
  },

  async uploadToGitHub(base64Data, isPromo = false) {
    if (!base64Data) return null;
    
    const secretSnap = await getDoc(doc(db, "sistema", "secretos")); 
    if (!secretSnap.exists()) throw new Error("Token no encontrado.");
    
    const token = secretSnap.data().token_github; 
    const nombreArchivo = isPromo ? `promo_${Date.now()}.webp` : `plato_${Date.now()}.webp`; 
    const repoPath = `sukidesumenu-svg/image_sukidesu`;
    const githubApiUrl = `https://api.github.com/repos/${repoPath}/contents/assets/img/${nombreArchivo}`;
    
    const res = await fetch(githubApiUrl, { 
      method: 'PUT', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        message: `Upload imagen: ${nombreArchivo}`, 
        content: base64Data, 
        branch: "main" 
      }) 
    });
    
    if (!res.ok) { 
      const errorData = await res.json(); 
      throw new Error(`Fallo API GitHub: ${errorData.message}`); 
    }
    
    return `https://recursos-sukidesu.pages.dev/assets/img/${nombreArchivo}`;
  },

  resetState() {
    this.pendingImageBase64 = null;
    this.pendingPromoImageBase64 = null;
  }
};