const thumb = document.getElementById("swipeThumb");
const track = document.getElementById("swipeTrack");
const portada = document.getElementById("portada");
const invitacion = document.getElementById("invitacion");
const nombreInvitado = document.getElementById("nombreInvitado");
const textoBoletos = document.getElementById("textoBoletos");
const inputBoletos = document.getElementById("boletosConfirmados");
const selectConfirmacion = document.getElementById("confirmacion");
const textareaObservaciones = document.getElementById("observaciones");
const mensajeConfirmacion = document.getElementById("mensajeConfirmacion");
const botonConfirmacion = document.getElementById("botonConfirmacion");
const confirmacionDesplegable = document.querySelector(".confirmacion-desplegable");
const textoBoletosDisponibles = document.getElementById("textoBoletosDisponibles");
const botonVerQr = document.getElementById("botonVerQr");
const paseModal = document.getElementById("paseModal");
const paseOverlay = document.getElementById("paseOverlay");
const botonCerrarPase = document.getElementById("botonCerrarPase");
const paseNombreInvitado = document.getElementById("paseNombreInvitado");
const paseCodigoInvitado = document.getElementById("paseCodigoInvitado");
const paseModalConfirmados = document.getElementById("paseModalConfirmados");
const paseModalPendientes = document.getElementById("paseModalPendientes");
const paseQr = document.getElementById("paseQr");
const musicaBoda = document.getElementById("musicaBoda");
const botonMusica = document.getElementById("botonMusica");
const apiEndpoint = document.body?.dataset.apiEndpoint?.trim() || "";

let isDragging = false;
let startX = 0;
let currentX = 0;
let maxX = 0;
let boletosAsignadosActual = 0;
let invitacionAbierta = false;
let enviandoConfirmacion = false;
let datosInvitadoActual = null;
let recargandoInvitado = false;
let qrPaseInstancia = null;
let paseDisponiblePrevio = false;
let paseDigitalInicializado = false;
let actualizarEstadoBotonMusica = null;

const params = new URLSearchParams(window.location.search);
const codigo = (params.get("codigo") || "").trim();
const urlInvitados = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSG8KaizpTc9UotXg00ZZrwzAPhzEd2owEqVAj3mVn5Yt5xYdHB9aYEBJYH0c7bg6SYNlyDS87QSkLS/pub?gid=0&single=true&output=csv";

const CONFIG = {
  invitadoDefault: "Invitado especial",
  mensajeSinCodigo: "Abre tu invitación desde el enlace con tu código personal.",
  mensajeCodigoInvalido: "No encontramos tu código de invitación",
  mensajeErrorInvitado: "Ocurrió un problema al cargar tus datos",
  mensajeCuentaRegresivaInvalida: "Configura una fecha válida en el elemento con id 'fechaEvento'",
  mensajeEndpointFaltante: "Falta configurar el endpoint de confirmación.",
  encabezadosInvitados: {
    codigo: "CODIGO_INVITADO",
    nombre: "NOMBRE_INVITADO",
    boletosAsignados: "BOLETOS_ASIGNADOS",
    boletosConfirmados: "BOLETOS_CONFIRMADOS",
    boletosDisponibles: "BOLETOS_DISPONIBLES",
    confirmacion: "CONFIRMACION",
    observaciones: "OBSERVACIONES",
    activo: "ACTIVO"
  }
};

let fechaLimiteConfirmacion = null;
let mensajeConfirmacionVencido = "El plazo para confirmar terminó.";
let fechaEventoGlobal = null;

function formatearFechaLarga(fecha) {
  return fecha.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function sincronizarFechasDelEvento() {
  const fechaEventoEl = document.getElementById("fechaEvento");
  const textoFechaLimiteEl = document.getElementById("textoFechaLimite");

  if (fechaEventoEl?.dataset.fechaEvento) {
    const fechaEventoTexto = fechaEventoEl.dataset.fechaEvento.trim();
    const fechaEventoParsada = new Date(fechaEventoTexto);

    if (!Number.isNaN(fechaEventoParsada.getTime())) {
      fechaEventoGlobal = fechaEventoParsada;
    } else {
      console.warn("Fecha de evento inválida en data-fecha-evento", fechaEventoTexto);
    }
  }

  if (textoFechaLimiteEl?.dataset.fechaLimite) {
    const fechaLimiteTexto = textoFechaLimiteEl.dataset.fechaLimite.trim();
    const fechaLimiteParsada = new Date(fechaLimiteTexto);

    if (!Number.isNaN(fechaLimiteParsada.getTime())) {
      fechaLimiteConfirmacion = fechaLimiteParsada;
      const fechaLimiteFormato = formatearFechaLarga(fechaLimiteParsada);

      textoFechaLimiteEl.textContent = `Confírmanos antes del ${fechaLimiteFormato}`;
      mensajeConfirmacionVencido = `El plazo para confirmar terminó el ${fechaLimiteFormato}.`;
    } else {
      console.warn("Fecha límite de confirmación inválida en data-fecha-limite", fechaLimiteTexto);
    }
  } else if (fechaEventoGlobal && !textoFechaLimiteEl?.dataset?.fechaLimite) {
    fechaLimiteConfirmacion = fechaEventoGlobal;
    const fechaEventoFormato = formatearFechaLarga(fechaEventoGlobal);

    if (textoFechaLimiteEl) {
      textoFechaLimiteEl.textContent = `Confírmanos antes del ${fechaEventoFormato}`;
    }

    mensajeConfirmacionVencido = `El plazo para confirmar terminó el ${fechaEventoFormato}.`;
  }
}

function parsearFilaCsv(fila) {
  return fila
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((valor) => valor.replace(/^"|"$/g, "").trim());
}

function normalizarEncabezado(texto) {
  return String(texto || "").trim().toUpperCase();
}

function crearMapaEncabezados(encabezados) {
  const mapa = {};

  encabezados.forEach((encabezado, index) => {
    const clave = normalizarEncabezado(encabezado);
    if (clave) {
      mapa[clave] = index;
    }
  });

  return mapa;
}

function obtenerValorColumna(columnas, mapa, nombreEncabezado) {
  const indice = mapa[normalizarEncabezado(nombreEncabezado)];
  if (typeof indice !== "number") return "";
  return columnas[indice] || "";
}

function obtenerNumeroSeguro(valor) {
  return parseInt(valor, 10) || 0;
}

function resolverBoletosDisponibles(boletosAsignados, boletosConfirmados, boletosDisponiblesSheet) {
  const disponiblesCalculados = Math.max(boletosAsignados - boletosConfirmados, 0);
  const textoDisponibles = String(boletosDisponiblesSheet || "").trim();

  if (!textoDisponibles) {
    return disponiblesCalculados;
  }

  const disponiblesSheet = obtenerNumeroSeguro(textoDisponibles);

  if (disponiblesSheet !== disponiblesCalculados) {
    return disponiblesCalculados;
  }

  return disponiblesSheet;
}

function construirTextoBoletos(invitado) {
  if (invitado.boletosAsignados === 1) {
    return "Hemos reservado 1 boleto para ti.";
  }

  if (invitado.boletosAsignados > 1) {
    return `Hemos reservado ${invitado.boletosAsignados} lugares en su honor.`;
  }

  return "Nos encantará compartir este día contigo";
}

function construirTextoBoletosDisponibles(invitado) {
  if (invitado.boletosConfirmados > 0 && invitado.boletosDisponibles > 0) {
    return `Ya confirmaste ${invitado.boletosConfirmados} y aún puedes confirmar ${invitado.boletosDisponibles} boleto(s).`;
  }

  if (invitado.boletosConfirmados > 0 && invitado.boletosDisponibles === 0) {
    return `Ya confirmaste tus ${invitado.boletosConfirmados} boleto(s).`;
  }

  if (invitado.boletosDisponibles > 0) {
    return `Aún tienes ${invitado.boletosDisponibles} boleto(s) disponible(s) por confirmar.`;
  }

  if (invitado.boletosAsignados > 0) {
    return "Por ahora no tienes boletos disponibles por confirmar.";
  }

  return "";
}

function construirUrlStaffDesdeToken(tokenGrupo) {
  if (!tokenGrupo) return "";

  const staffUrl = new URL("staff.html", window.location.href);
  staffUrl.searchParams.set("token", tokenGrupo);
  return staffUrl.toString();
}

function resetearPaseDigital() {
  if (paseModal) {
    paseModal.hidden = true;
  }

  document.body.classList.remove("pase-modal-open");

  if (botonVerQr) {
    botonVerQr.hidden = true;
  }

  if (paseQr) {
    paseQr.innerHTML = "";
  }

  qrPaseInstancia = null;
}

function renderizarQrPase() {
  if (!paseQr || !datosInvitadoActual?.tokenGrupo || typeof QRCode === "undefined") {
    return;
  }

  if (qrPaseInstancia) {
    return;
  }

  const urlStaff = construirUrlStaffDesdeToken(datosInvitadoActual.tokenGrupo);
  if (!urlStaff) return;

  paseQr.innerHTML = "";
  qrPaseInstancia = new QRCode(paseQr, {
    text: urlStaff,
    width: 210,
    height: 210,
    colorDark: "#5b4337",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function actualizarPaseDigital() {
  if (!datosInvitadoActual) {
    paseDisponiblePrevio = false;
    resetearPaseDigital();
    return;
  }

  const confirmados = datosInvitadoActual.boletosConfirmados || 0;
  const asignados = datosInvitadoActual.boletosAsignados || 0;
  const pendientes = Math.max(asignados - confirmados, 0);
  const tieneToken = Boolean(datosInvitadoActual.tokenGrupo);
  const tienePase = confirmados > 0;
  const puedeAbrirPase = tienePase && tieneToken;

  if (!tienePase) {
    paseDisponiblePrevio = false;
    resetearPaseDigital();
    return;
  }

  if (paseNombreInvitado) paseNombreInvitado.textContent = datosInvitadoActual.nombre || CONFIG.invitadoDefault;
  if (paseCodigoInvitado) paseCodigoInvitado.textContent = codigo || "-";
  if (paseModalConfirmados) paseModalConfirmados.textContent = String(confirmados);
  if (paseModalPendientes) paseModalPendientes.textContent = String(pendientes);

  if (botonVerQr) {
    botonVerQr.hidden = !puedeAbrirPase || !invitacionAbierta;
  }

  if (!paseDigitalInicializado) {
    paseDigitalInicializado = true;
    paseDisponiblePrevio = puedeAbrirPase;
    return;
  }

  if (puedeAbrirPase && !paseDisponiblePrevio) {
    abrirModalPase();
  }

  paseDisponiblePrevio = puedeAbrirPase;
}

function bloquearConfirmacionPorDisponibilidad() {
  if (selectConfirmacion) selectConfirmacion.disabled = true;
  if (inputBoletos) inputBoletos.disabled = true;
  if (textareaObservaciones) textareaObservaciones.disabled = true;
  if (botonConfirmacion) botonConfirmacion.disabled = true;
}

function habilitarCamposBaseConfirmacion() {
  if (selectConfirmacion) selectConfirmacion.disabled = false;
  if (textareaObservaciones) textareaObservaciones.disabled = false;
  if (botonConfirmacion) botonConfirmacion.disabled = enviandoConfirmacion;
}

function deshabilitarConfirmacionCompleta() {
  bloquearConfirmacionPorDisponibilidad();
  if (inputBoletos) {
    inputBoletos.value = "";
  }
}

function laFechaDeConfirmacionYaVencio() {
  if (!fechaLimiteConfirmacion || Number.isNaN(fechaLimiteConfirmacion.getTime())) {
    return false;
  }

  return new Date() > fechaLimiteConfirmacion;
}

function sincronizarEstadoConfirmacion() {
  if (!selectConfirmacion || !inputBoletos || !textareaObservaciones || !botonConfirmacion) {
    return;
  }

  if (!codigo || !datosInvitadoActual) {
    deshabilitarConfirmacionCompleta();
    return;
  }

  if (laFechaDeConfirmacionYaVencio()) {
    deshabilitarConfirmacionCompleta();
    mostrarMensajeConfirmacion(mensajeConfirmacionVencido, true);
    return;
  }

  habilitarCamposBaseConfirmacion();

  if (datosInvitadoActual.boletosDisponibles < 1) {
    deshabilitarConfirmacionCompleta();
    mostrarMensajeConfirmacion("Ya confirmaste todos tus boletos disponibles.");
    return;
  }

  actualizarEstadoBoletos();
}

function actualizarResumenConfirmacion() {
  if (!datosInvitadoActual || !textoBoletosDisponibles) return;

  textoBoletosDisponibles.textContent = construirTextoBoletosDisponibles(datosInvitadoActual);
  sincronizarEstadoConfirmacion();
}

function actualizarOpcionesBoletos() {
  if (!inputBoletos) return;

  const valorActual = inputBoletos.value;
  inputBoletos.innerHTML = "";

  const opcionBase = document.createElement("option");
  opcionBase.value = "";
  opcionBase.textContent = boletosAsignadosActual > 0
    ? "Selecciona cuántos boletos usarás"
    : "Sin boletos disponibles";
  inputBoletos.appendChild(opcionBase);

  for (let i = 1; i <= boletosAsignadosActual; i += 1) {
    const opcion = document.createElement("option");
    opcion.value = String(i);
    opcion.textContent = i === 1 ? "1 boleto" : `${i} boletos`;
    inputBoletos.appendChild(opcion);
  }

  if (valorActual && Number(valorActual) <= boletosAsignadosActual) {
    inputBoletos.value = valorActual;
  } else {
    inputBoletos.value = "";
  }
}

function aplicarDatosInvitado(invitado) {
  datosInvitadoActual = { ...invitado };
  boletosAsignadosActual = invitado.boletosDisponibles;

  if (inputBoletos) {
    actualizarOpcionesBoletos();
  }

  if (selectConfirmacion) {
    const confirmacionNormalizada = String(invitado.confirmacion || "").trim().toUpperCase();
    selectConfirmacion.value = confirmacionNormalizada === "PARCIAL" ? "SI" : confirmacionNormalizada;
  }

  if (textareaObservaciones) {
    textareaObservaciones.value = invitado.observaciones || "";
  }

  nombreInvitado.textContent = invitado.nombre;
  textoBoletos.textContent = construirTextoBoletos(invitado);
  actualizarResumenConfirmacion();
  actualizarPaseDigital();
}

function cargarDatosInvitadoDesdeSheets() {
  recargandoInvitado = true;
  return fetch(urlInvitados, {
    method: "GET",
    cache: "no-store"
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("No se pudo consultar la hoja de invitados");
      }

      return response.text();
    })
    .then((data) => {
      const filas = data.trim().split("\n");
      if (!filas.length) {
        throw new Error("La hoja de invitados está vacía");
      }

      const encabezados = parsearFilaCsv(filas[0]);
      const mapaEncabezados = crearMapaEncabezados(encabezados);

      for (let i = 1; i < filas.length; i++) {
        const columnas = parsearFilaCsv(filas[i]);
        const codigoSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.codigo);
        const activoSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.activo);

        if (codigoSheet !== codigo) continue;
        if (activoSheet && normalizarEncabezado(activoSheet) === "NO") {
          throw new Error("Esta invitación no está activa");
        }

        const nombreSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.nombre);
        const boletosAsignadosSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.boletosAsignados);
        const boletosConfirmadosSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.boletosConfirmados);
        const boletosDisponiblesSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.boletosDisponibles);
        const confirmacionSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.confirmacion);
        const observacionesSheet = obtenerValorColumna(columnas, mapaEncabezados, CONFIG.encabezadosInvitados.observaciones);

        const boletosAsignados = obtenerNumeroSeguro(boletosAsignadosSheet);
        const boletosConfirmados = obtenerNumeroSeguro(boletosConfirmadosSheet);
        const boletosDisponibles = resolverBoletosDisponibles(
          boletosAsignados,
          boletosConfirmados,
          boletosDisponiblesSheet
        );

        aplicarDatosInvitado({
          nombre: nombreSheet || CONFIG.invitadoDefault,
          boletosAsignados,
          boletosConfirmados,
          boletosDisponibles,
          confirmacion: confirmacionSheet,
          observaciones: observacionesSheet,
          tokenGrupo: datosInvitadoActual?.tokenGrupo || "",
          accesosUsados: datosInvitadoActual?.accesosUsados || 0
        });
        return;
      }

      throw new Error(CONFIG.mensajeCodigoInvalido);
    })
    .finally(() => {
      recargandoInvitado = false;
    });
}

function aplicarDatosInvitadoDesdeApi(invitado) {
  const boletosAsignados = obtenerNumeroSeguro(invitado?.boletosAsignados);
  const boletosConfirmados = obtenerNumeroSeguro(invitado?.boletosConfirmados);
  const boletosDisponibles = obtenerNumeroSeguro(invitado?.boletosDisponibles);

  aplicarDatosInvitado({
    nombre: String(invitado?.nombre || CONFIG.invitadoDefault).trim(),
    boletosAsignados,
    boletosConfirmados,
    boletosDisponibles,
    confirmacion: String(invitado?.confirmacion || "").trim(),
    observaciones: String(invitado?.observaciones || "").trim(),
    tokenGrupo: String(invitado?.tokenGrupo || "").trim(),
    accesosUsados: obtenerNumeroSeguro(invitado?.accesosUsados)
  });
}

function cargarDatosInvitadoDesdeApi() {
  if (!apiEndpoint) {
    return Promise.reject(new Error(CONFIG.mensajeEndpointFaltante));
  }

  recargandoInvitado = true;
  const url = apiEndpoint + "?" + new URLSearchParams({
    action: "invitado",
    codigo: codigo
  }).toString();

  return fetch(url, {
    method: "GET",
    cache: "no-store"
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("No se pudo consultar el invitado");
      }

      return response.json();
    })
    .then((payload) => {
      if (!payload?.ok || !payload?.invitado) {
        throw new Error(payload?.message || CONFIG.mensajeErrorInvitado);
      }

      aplicarDatosInvitadoDesdeApi(payload.invitado);
    })
    .finally(() => {
      recargandoInvitado = false;
    });
}

function actualizarEstadoBoletos() {
  if (!inputBoletos || !selectConfirmacion) return;
  if (datosInvitadoActual?.boletosDisponibles < 1) {
    inputBoletos.disabled = true;
    inputBoletos.value = "";
    return;
  }

  const asistenciaConfirmada = selectConfirmacion.value === "SI";
  inputBoletos.disabled = !asistenciaConfirmada || boletosAsignadosActual < 1;

  if (!asistenciaConfirmada || boletosAsignadosActual < 1) {
    inputBoletos.value = "";
  }
}

function mostrarMensajeConfirmacion(texto, esError = false) {
  if (!mensajeConfirmacion) return;

  mensajeConfirmacion.textContent = texto;
  mensajeConfirmacion.style.color = esError ? "#9f3a38" : "#4a3b33";
}

function validarFechaConfirmacion() {
  const fechaHaPasado = laFechaDeConfirmacionYaVencio();

  if (fechaHaPasado) {
    sincronizarEstadoConfirmacion();
  }

  return !fechaHaPasado;
}

function iniciarSwipe(clientX) {
  if (!thumb || !track || invitacionAbierta) return;

  isDragging = true;
  startX = clientX - currentX;
  maxX = track.offsetWidth - thumb.offsetWidth;
}

function moverSwipe(clientX) {
  if (!isDragging || !thumb) return;

  currentX = clientX - startX;

  if (currentX < 0) currentX = 0;
  if (currentX > maxX) currentX = maxX;

  thumb.style.left = currentX + "px";
}

function terminarSwipe() {
  if (!isDragging || !thumb) return;

  isDragging = false;

  if (currentX >= maxX * 0.85) {
    thumb.style.left = maxX + "px";
    abrirInvitacion();
    return;
  }

  currentX = 0;
  thumb.style.left = "0px";
}

function abrirInvitacion() {
  if (!portada || !invitacion) return;
  if (invitacionAbierta) return;

  invitacionAbierta = true;

  if (botonMusica) {
    botonMusica.hidden = false;
  }

  if (musicaBoda?.paused) {
    musicaBoda.play()
      .then(() => {
        if (typeof actualizarEstadoBotonMusica === "function") {
          actualizarEstadoBotonMusica(true);
        }
      })
      .catch((error) => {
        console.warn("No se pudo iniciar la música al abrir la invitación:", error);
      });
  }

  portada.style.transition = "opacity 0.6s ease";
  portada.style.opacity = "0";

  setTimeout(() => {
    portada.style.display = "none";
    invitacion.hidden = false;
    invitacion.style.display = "block";
    invitacion.style.opacity = "0";
    invitacion.style.transform = "translateY(20px)";

    setTimeout(() => {
      invitacion.style.transition = "all 0.8s ease";
      invitacion.style.opacity = "1";
      invitacion.style.transform = "translateY(0)";
      actualizarPaseDigital();
      invitacion.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, 600);
}

function inicializarReveladoSecciones() {
  const secciones = document.querySelectorAll("#invitacion > section");
  if (!secciones.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  secciones.forEach((seccion) => {
    seccion.classList.add("reveal-on-scroll");
  });

  if (reduceMotion || typeof IntersectionObserver === "undefined") {
    secciones.forEach((seccion) => {
      seccion.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -10% 0px"
  });

  secciones.forEach((seccion) => {
    observer.observe(seccion);
  });
}

function inicializarSwipe() {
  if (!thumb || !track) return;

  thumb.addEventListener("mousedown", (e) => {
    iniciarSwipe(e.clientX);
  });

  document.addEventListener("mousemove", (e) => {
    moverSwipe(e.clientX);
  });

  document.addEventListener("mouseup", terminarSwipe);

  thumb.addEventListener("touchstart", (e) => {
    e.preventDefault();
    iniciarSwipe(e.touches[0].clientX);
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    moverSwipe(e.touches[0].clientX);
  }, { passive: false });

  document.addEventListener("touchend", terminarSwipe);

  thumb.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;

    e.preventDefault();
    abrirInvitacion();
  });
}

function cargarDatosInvitado() {
  if (!nombreInvitado || !textoBoletos) return Promise.resolve();

  datosInvitadoActual = null;
  boletosAsignadosActual = 0;
  sincronizarEstadoConfirmacion();

  if (!codigo) {
    nombreInvitado.textContent = CONFIG.invitadoDefault;
    textoBoletos.textContent = CONFIG.mensajeSinCodigo;
    resetearPaseDigital();
    return Promise.resolve();
  }

  return cargarDatosInvitadoDesdeApi()
    .catch((error) => {
      console.warn("Fallo lectura en vivo; se intenta CSV publicado.", error);
      return cargarDatosInvitadoDesdeSheets();
    })
    .catch((error) => {
      console.error("Error al consultar invitado:", error);
      nombreInvitado.textContent = CONFIG.invitadoDefault;
      textoBoletos.textContent = error.message || CONFIG.mensajeErrorInvitado;
      if (selectConfirmacion) selectConfirmacion.value = "";
      if (textareaObservaciones) textareaObservaciones.value = "";
      if (textoBoletosDisponibles) textoBoletosDisponibles.textContent = "";
      resetearPaseDigital();
      sincronizarEstadoConfirmacion();
    });
}

function enviarConfirmacion() {
  if (!mensajeConfirmacion) {
    console.error("No existe el elemento #mensajeConfirmacion");
    return;
  }

  if (!apiEndpoint) {
    mostrarMensajeConfirmacion(CONFIG.mensajeEndpointFaltante, true);
    return;
  }

  if (!validarFechaConfirmacion() || enviandoConfirmacion) return;

  const confirmacion = selectConfirmacion?.value || "";
  const boletosSeleccionados = inputBoletos?.value || "";
  const observaciones = textareaObservaciones?.value.trim() || "";

  if (!codigo) {
    mostrarMensajeConfirmacion("No encontramos tu código de invitación en el enlace.", true);
    return;
  }

  if (!confirmacion) {
    mostrarMensajeConfirmacion("Selecciona si asistirás.", true);
    return;
  }

  let boletosFinal = 0;

  if (confirmacion === "SI") {
    if (boletosAsignadosActual < 1) {
      mostrarMensajeConfirmacion("Ya no tienes boletos disponibles por confirmar.", true);
      return;
    }

    boletosFinal = parseInt(boletosSeleccionados, 10) || 0;

    if (boletosFinal < 1) {
      mostrarMensajeConfirmacion("Indica cuántos boletos usarás.", true);
      return;
    }

    if (boletosFinal > boletosAsignadosActual) {
      mostrarMensajeConfirmacion("Solo puedes confirmar hasta " + boletosAsignadosActual + " boletos.", true);
      return;
    }
  }

  enviandoConfirmacion = true;
  if (botonConfirmacion) botonConfirmacion.disabled = true;
  mostrarMensajeConfirmacion("Enviando...");

  const paramsEnvio = new URLSearchParams({
    action: "confirmar",
    codigo: codigo,
    confirmacion: confirmacion,
    boletos: String(boletosFinal),
    observaciones: observaciones
  });

  fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: paramsEnvio.toString()
  })
    .then((response) => {
      if (response.status === 405 || response.status === 501) {
        return fetch(apiEndpoint + "?" + paramsEnvio.toString());
      }

      if (!response.ok) {
        throw new Error("No se pudo enviar la confirmación");
      }

      return response.text();
    })
    .then((texto) => {
      const respuesta = texto.trim();
      let payload = null;

      if (respuesta.startsWith("{") || respuesta.startsWith("[")) {
        try {
          payload = JSON.parse(respuesta);
        } catch (error) {
          payload = null;
        }
      }

      if (payload?.ok === false) {
        mostrarMensajeConfirmacion(payload.message || "Error al enviar la confirmación.", true);
        return;
      }

      if (respuesta === "OK" || payload?.ok === true) {
        if (inputBoletos) inputBoletos.value = "";
        if (textareaObservaciones) textareaObservaciones.value = "";
        mostrarMensajeConfirmacion("Confirmación enviada correctamente.");
        return cargarDatosInvitado();
      } else {
        mostrarMensajeConfirmacion("Respuesta del servidor: " + texto, true);
      }
    })
    .catch((error) => {
      console.error("Error fetch:", error);
      mostrarMensajeConfirmacion("Error al enviar la confirmación.", true);
    })
    .finally(() => {
      enviandoConfirmacion = false;
      if (botonConfirmacion) botonConfirmacion.disabled = false;
    });
}

function iniciarCuentaRegresiva() {
  const countdown = document.getElementById("countdown");
  if (!countdown) return;

  if (!fechaEventoGlobal || Number.isNaN(fechaEventoGlobal.getTime())) {
    countdown.innerHTML = `<div class="countdown-loading">${CONFIG.mensajeCuentaRegresivaInvalida}</div>`;
    return;
  }

  let intervalo = null;

  function renderizarUnidad(valor, etiqueta) {
    return `
      <div class="countdown-item">
        <span class="countdown-valor">${String(valor).padStart(2, "0")}</span>
        <span class="countdown-divisor" aria-hidden="true"></span>
        <span class="countdown-label">${etiqueta}</span>
      </div>
    `;
  }

  function actualizarCuentaRegresiva() {
    const diferenciaMs = fechaEventoGlobal.getTime() - Date.now();

    if (diferenciaMs <= 0) {
      countdown.innerHTML = `<div class="countdown-loading">¡Hoy es el gran día!</div>`;
      if (intervalo) clearInterval(intervalo);
      return;
    }

    const totalSegundos = Math.floor(diferenciaMs / 1000);
    const dias = Math.floor(totalSegundos / 86400);
    const horas = Math.floor((totalSegundos % 86400) / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    countdown.innerHTML = [
      renderizarUnidad(dias, "Días"),
      renderizarUnidad(horas, "Horas"),
      renderizarUnidad(minutos, "Minutos"),
      renderizarUnidad(segundos, "Segundos")
    ].join("");
  }

  actualizarCuentaRegresiva();
  intervalo = setInterval(actualizarCuentaRegresiva, 1000);
}

function abrirModalPase() {
  if (!paseModal || !datosInvitadoActual?.tokenGrupo) return;

  renderizarQrPase();
  paseModal.hidden = false;
  document.body.classList.add("pase-modal-open");
}

function cerrarModalPase() {
  if (!paseModal) return;

  paseModal.hidden = true;
  document.body.classList.remove("pase-modal-open");
}

function inicializarMusica() {
  if (!musicaBoda || !botonMusica) return;

  botonMusica.hidden = true;

  actualizarEstadoBotonMusica = (estaReproduciendo) => {
    botonMusica.classList.toggle("is-playing", estaReproduciendo);
    botonMusica.setAttribute("aria-label", estaReproduciendo ? "Pausar música" : "Reproducir música");
    const texto = botonMusica.querySelector(".boton-musica-texto");
    if (texto) {
      texto.textContent = estaReproduciendo ? "Pausar" : "Música";
    }
  };

  botonMusica.addEventListener("click", async () => {
    try {
      if (musicaBoda.paused) {
        await musicaBoda.play();
        actualizarEstadoBotonMusica(true);
      } else {
        musicaBoda.pause();
        actualizarEstadoBotonMusica(false);
      }
    } catch (error) {
      console.error("No se pudo reproducir el audio:", error);
      const texto = botonMusica.querySelector(".boton-musica-texto");
      if (texto) {
        texto.textContent = "Error";
      }
    }
  });

  musicaBoda.addEventListener("ended", () => {
    actualizarEstadoBotonMusica(false);
  });

  actualizarEstadoBotonMusica(false);
}

function inicializarConfirmacionDesplegable() {
  if (!confirmacionDesplegable) return;

  confirmacionDesplegable.addEventListener("toggle", () => {
    window.setTimeout(() => {
      const bloqueConfirmacion = confirmacionDesplegable.closest(".bloque-confirmacion");
      const destino = bloqueConfirmacion || confirmacionDesplegable;

      destino.scrollIntoView({
        behavior: "smooth",
        block: confirmacionDesplegable.open ? "nearest" : "nearest"
      });
    }, 60);
  });
}

sincronizarFechasDelEvento();
inicializarReveladoSecciones();
inicializarSwipe();
inicializarMusica();
inicializarConfirmacionDesplegable();
resetearPaseDigital();
cargarDatosInvitado();
iniciarCuentaRegresiva();
actualizarEstadoBoletos();
validarFechaConfirmacion();

if (selectConfirmacion) {
  selectConfirmacion.addEventListener("change", actualizarEstadoBoletos);
}

if (botonConfirmacion) {
  botonConfirmacion.addEventListener("click", enviarConfirmacion);
}

if (botonVerQr) {
  botonVerQr.addEventListener("click", abrirModalPase);
}

if (botonCerrarPase) {
  botonCerrarPase.addEventListener("click", cerrarModalPase);
}

if (paseOverlay) {
  paseOverlay.addEventListener("click", cerrarModalPase);
}

window.addEventListener("focus", () => {
  if (!recargandoInvitado) {
    cargarDatosInvitado();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !recargandoInvitado) {
    cargarDatosInvitado();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && paseModal && !paseModal.hidden) {
    cerrarModalPase();
  }
});
