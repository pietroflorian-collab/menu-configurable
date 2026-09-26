// configFooter.js

export const datosEstablecimiento = {
    nombre: "SUKIDESU SUSHI",
    correoPQR: "sushisukidesu2025@gmail.com",
    desarrollador: "Pietro Florian Galea",
    whatsappDev: "+573025303152",
    urlSIC: "https://www.sic.gov.co/"
};

export const footerHTML = `
<footer class="bg-surface-container-lowest text-tertiary font-footer-texto size-footer-texto mt-auto border-t border-outline-20">
  <div class="flex flex-col md:flex-row flex-wrap justify-between items-start px-5 md:px-12 py-8 max-w-7xl mx-auto gap-8">

    <div class="flex flex-col mb-4 md:mb-0 w-full md:w-auto">
      <div class="font-nav-negocio size-nav-negocio text-primary mb-2">${datosEstablecimiento.nombre}</div>
      <div class="font-footer-texto size-footer-texto text-secondary">© 2026 ${datosEstablecimiento.nombre}. Todos los Derechos Reservados.</div>
    </div>

    <div class="flex flex-col w-full md:w-auto">
      <h4 class="font-footer-links size-footer-links font-bold text-primary mb-3">Atención al Cliente</h4>
      <a href="mailto:${datosEstablecimiento.correoPQR}" class="font-footer-links size-footer-links hover:text-primary transition-colors mb-1">${datosEstablecimiento.correoPQR}</a>
      <span class="font-footer-texto size-footer-texto text-secondary mt-1">Respuesta PQR: máx. 15 días hábiles</span>
    </div>

    <div class="flex flex-col w-full md:w-auto">
      <h4 class="font-footer-links size-footer-links font-bold text-primary mb-3">Información Legal</h4>
      <a href="terminos.html" class="font-footer-links size-footer-links hover:text-primary transition-colors mb-2">Términos y Condiciones</a>
      <a href="privacidad.html" class="font-footer-links size-footer-links hover:text-primary transition-colors mb-2">Política de Privacidad</a>
      <a href="${datosEstablecimiento.urlSIC}" target="_blank" rel="noopener noreferrer" class="font-footer-links size-footer-links hover:text-primary transition-colors">Superintendencia (SIC)</a>
    </div>
  </div>

  <div class="border-t border-outline-20 py-4 text-center font-footer-texto size-footer-texto text-secondary px-5">
    Desarrollado por ${datosEstablecimiento.desarrollador} | <a href="https://wa.me/${datosEstablecimiento.whatsappDev}" target="_blank" rel="noopener noreferrer" class="hover:text-primary underline transition-colors">WhatsApp: ${datosEstablecimiento.whatsappDev}</a>
  </div>
</footer>
`;