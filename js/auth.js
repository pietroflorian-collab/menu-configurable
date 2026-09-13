import { auth, db, showToast } from './api.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { initializeApp, getApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

export const AuthManager = {
  currentUser: null, 
  userRole: null,

  init(onSuccessCallback) {
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
            if (loginOverlay) loginOverlay.classList.add('hidden'); 
            if (adminLayout) adminLayout.classList.remove('hidden'); 
            
            // Ejecuta el inicializador del panel administrativo si el login es exitoso
            if (onSuccessCallback) onSuccessCallback(); 
          } else { 
            throw new Error("Usuario sin roles asignados o revocado."); 
          }
        } catch (error) { 
          console.error(error); 
          showToast("Acceso denegado. Perfil revocado.", "error"); 
          this.logout(); 
        }
      } else { 
        if (loginOverlay) loginOverlay.classList.remove('hidden'); 
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
