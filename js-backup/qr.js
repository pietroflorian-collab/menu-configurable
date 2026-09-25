export const QRGenerator = {
  qrCode: null,
  defaultLogo: 'images/screen.png',
  uploadedLogo: null,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    
    // Inicializar el motor vectorial
    this.qrCode = new QRCodeStyling({
      width: 303,
      height: 303,
      margin: 0,
      type: "svg",
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5
      }
    });

    const container = document.getElementById("qr-preview-container");
    if (container) {
      container.innerHTML = "";
      this.qrCode.append(container);
    }

    this.bindEvents();
    this.isInitialized = true;
  },

  bindEvents() {
    const inputs = [
      'qr-input-url', 'qr-input-texto', 'qr-style-dots', 
      'qr-style-corners', 'qr-color-dots', 'qr-color-corners', 
      'qr-color-bg', 'qr-logo-bg'
    ];
    
    inputs.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.update());
    });

    document.getElementById('qr-input-file')?.addEventListener('change', (e) => this.handleLogoUpload(e));
    document.getElementById('qr-dl-raw')?.addEventListener('click', () => this.downloadRaw());
    document.getElementById('qr-dl-poster')?.addEventListener('click', () => this.downloadPoster());
  },

  handleLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.uploadedLogo = e.target.result;
        this.update();
      };
      reader.readAsDataURL(file);
    }
  },

  update() {
    if (!this.qrCode) return;

    let baseUrl = document.getElementById('qr-input-url')?.value.trim() || "https://menusukidesu.sukidesumenu.workers.dev/?v=2";
    if(baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    const textoQR = document.getElementById('qr-input-texto')?.value.trim() || 'MENÚ';
    document.getElementById('qr-preview-text').innerText = textoQR;

    const hoy = new Date();
    const tokenSecreto = hoy.getDate() + (hoy.getFullYear() * 76);
    const urlRastreo = `${baseUrl}/?mesa=${encodeURIComponent(textoQR.replace(/\s+/g, '_'))}&tk=${tokenSecreto}`;

    const dotsType = document.getElementById('qr-style-dots')?.value || "rounded";
    const cornersType = document.getElementById('qr-style-corners')?.value || "extra-rounded";
    const colorDots = document.getElementById('qr-color-dots')?.value || "#000000";
    const colorCorners = document.getElementById('qr-color-corners')?.value || "#b71f22";
    const colorBg = document.getElementById('qr-color-bg')?.value || "#ffffff";
    const hideBgBehindLogo = document.getElementById('qr-logo-bg')?.checked ?? true;

    this.qrCode.update({
      data: urlRastreo,
      dotsOptions: { color: colorDots, type: dotsType },
      cornersSquareOptions: { color: colorCorners, type: cornersType },
      cornersDotOptions: { color: colorCorners, type: cornersType === 'extra-rounded' ? 'dot' : 'square' },
      backgroundOptions: { color: colorBg },
      image: this.uploadedLogo || this.defaultLogo,
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        hideBackgroundDots: hideBgBehindLogo
      }
    });
  },

  async downloadRaw() {
    const textoQR = document.getElementById('qr-input-texto')?.value.trim() || 'QR';
    this.qrCode.download({ name: `QR_${textoQR.replace(/\s+/g, '_')}`, extension: "png" });
  },

  async downloadPoster() {
    const btn = document.getElementById('qr-dl-poster');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Creando...`;
    btn.disabled = true;

    try {
      const textoQR = document.getElementById('qr-input-texto')?.value.trim() || 'MENÚ';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Lienzo Vertical (Formato Acrílico/Póster)
      canvas.width = 800;
      canvas.height = 1200;

      // Fondo oscuro
      ctx.fillStyle = '#131313';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradiente central radial sutil
      const gradient = ctx.createRadialGradient(400, 600, 100, 400, 600, 800);
      gradient.addColorStop(0, '#2a1214');
      gradient.addColorStop(1, '#131313');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Textos Superiores
      ctx.fillStyle = '#b71f22'; // Rojo primario
      ctx.font = 'bold 50px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUKIDESU SUSHI', 400, 150);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('ESCANEA PARA VER EL MENÚ', 400, 220);

      // Extraer el QR renderizado en alta calidad
      const qrBlob = await this.qrCode.getRawData("png");
      const qrUrl = URL.createObjectURL(qrBlob);
      
      // Dibujar QR y marco
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Marco blanco
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.roundRect(150, 280, 500, 500, 30);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // QR
          ctx.drawImage(img, 175, 305, 450, 450);

          // Textos Inferiores
          ctx.fillStyle = '#ACC677'; // Wasabi
          ctx.font = 'bold 70px "Anybody", sans-serif';
          ctx.fillText(textoQR.toUpperCase(), 400, 920);

          ctx.fillStyle = '#888888';
          ctx.font = '22px sans-serif';
          ctx.fillText('Experimenta los sabores más audaces.', 400, 1020);

          resolve();
        };
        img.src = qrUrl;
      });

      // Exportar
      const link = document.createElement('a');
      link.download = `Poster_${textoQR.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

    } catch (e) {
      console.error("Error al generar el póster:", e);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
};