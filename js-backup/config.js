export const AppConfig = {
  // 1. DATOS DE IDENTIDAD Y CONTACTO DEL CLIENTE
  cliente: {
    nombre: "SUKIDESU SUSHI",
    eslogan: "¡QUÉ CHIMBA DE SUSHI!",
    descripcionComercial: "Experimenta los sabores más audaces de la ciudad. Enrollados a mano a la perfección, servidos con una sonrisa.",
    whatsappCliente: "+573000000000", // Reemplazar por el número real
    correoPQR: "sushisukidesu2025@gmail.com",
    direccionLegal: "Cl. 28 # 66-10, San Gabriel, Itagüí, Antioquia",
    representanteLegal: "Lorena Sanchez Gonzalez",
    documentoIdentidad: "PPT 2433271",
    declaracionTributaria: "No Responsable del Impuesto Nacional al Consumo (INC) ni del Impuesto sobre las Ventas (IVA)",
    desarrollador: "Pietro Florian Galea",
    whatsappDev: "+573000000000" // Reemplazar por el número real
  },

  // 2. CONFIGURACIÓN DEL PROVEEDOR DE INFRAESTRUCTURA (FIREBASE)
  firebase: {
    apiKey: "AIzaSyC-bFjUVczmEyaEL_jRhmaKJIsuTleooIw",
    authDomain: "bdmenusukidesu2.firebaseapp.com",
    projectId: "bdmenusukidesu2",
    storageBucket: "bdmenusukidesu2.firebasestorage.app",
    messagingSenderId: "193702895694",
    appId: "1:193702895694:web:0a0083ea520096ddbc231f"
  },

  // 3. ENLACES Y CONFIGURACIÓN DE RUTEO
  urls: {
    produccion: "https://pietroflorian-collab.github.io/menu_sukidesu/",
    recursosCdn: ".",
    instagram: "https://instagram.com/sukidesu.sushi",
    facebook: "https://facebook.com/sukidesusushi",
    tiktok: "https://tiktok.com/@sukidesusushi",
    enteRegulador: "https://www.sic.gov.co/"
  },
  
  // 4. CONFIGURACIÓN DEL REPOSITORIO (GITHUB)
  github: {
    repoPath: "sukidesumenu-svg/image_sukidesu"
  },

  // 5. CONFIGURACIÓN VISUAL Y PREFIJOS LOCALES
  ui: {
    app_prefix: "sukidesu_v2",
    colores_canvas: {
      fondo_lienzo: "#0a0a0a",
      fondo_qr_box: "#FFFFFF",
      qr_oscuro: "#000000",
      qr_claro: "#FFFFFF",
      texto_etiqueta: "#FFFFFF"
    }
  }
};