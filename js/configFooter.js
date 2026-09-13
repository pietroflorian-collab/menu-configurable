// configFooter.js

export const datosEstablecimiento = {
    nombre: "SUKIDESU SUSHI",
    correoPQR: "sushisukidesu2025@gmail.com",
    desarrollador: "Pietro Florian Galea",
    whatsappDev: "+573025303152",
    urlSIC: "https://www.sic.gov.co/"
};

export const footerHTML = `
<footer class="bg-surface-container-lowest text-tertiary font-body-md text-body-md mt-auto border-t border-outline-variant/20">
  <div class="flex flex-col md:flex-row flex-wrap justify-between items-start px-5 md:px-12 py-8 max-w-7xl mx-auto gap-8">
    
    <!-- Columna 1: Marca y Copyright -->
    <div class="flex flex-col mb-4 md:mb-0 w-full md:w-auto">
      <div class="font-headline-lg text-primary mb-2">${datosEstablecimiento.nombre}</div>
      <div class="text-sm text-secondary">© 2026 ${datosEstablecimiento.nombre}. Todos los Derechos Reservados.</div>
    </div>

    <!-- Columna 2: PQR y Atención -->
    <div class="flex flex-col w-full md:w-auto text-sm">
      <h4 class="font-bold text-primary mb-3">Atención al Cliente</h4>
      <a href="mailto:${datosEstablecimiento.correoPQR}" class="hover:text-primary transition-colors mb-1">${datosEstablecimiento.correoPQR}</a>
      <span class="text-xs text-secondary mt-1">Respuesta PQR: máx. 15 días hábiles</span>
    </div>

    <!-- Columna 3: Legal -->
    <div class="flex flex-col w-full md:w-auto text-sm">
      <h4 class="font-bold text-primary mb-3">Información Legal</h4>
      <a href="terminos.html" class="hover:text-primary transition-colors mb-2">Términos y Condiciones</a>
      <a href="privacidad.html" class="hover:text-primary transition-colors mb-2">Política de Privacidad</a>
      <a href="${datosEstablecimiento.urlSIC}" target="_blank" rel="noopener noreferrer" class="hover:text-primary transition-colors">Superintendencia (SIC)</a>
    </div>
  </div>
  
  <!-- Créditos de Desarrollo -->
  <div class="border-t border-outline-variant/20 py-4 text-center text-xs text-secondary px-5">
    Desarrollado por ${datosEstablecimiento.desarrollador} | <a href="https://wa.me/${datosEstablecimiento.whatsappDev}" target="_blank" rel="noopener noreferrer" class="hover:text-primary underline transition-colors">WhatsApp: ${datosEstablecimiento.whatsappDev}</a>
  </div>
</footer>
`;