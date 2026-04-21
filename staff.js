const staffApiEndpoint = document.body?.dataset.apiEndpoint?.trim() || "";
const staffParams = new URLSearchParams(window.location.search);
let tokenGrupo = (staffParams.get("token") || "").trim();

const staffPortada = document.getElementById("staffPortada");
const staffPanel = document.getElementById("staffPanel");
const botonEscanearQR = document.getElementById("botonEscanearQR");
const staffTokenManual = document.getElementById("staffTokenManual");
const botonIniciarRegistro = document.getElementById("botonIniciarRegistro");
const staffStatusPortada = document.getElementById("staffStatusPortada");
const staffVideoContainer = document.getElementById("staffVideoContainer");
const staffQrRegion = document.getElementById("staffQrRegion");
const botonDetenerEscaner = document.getElementById("botonDetenerEscaner");
const botonCambiarCamara = document.getElementById("botonCambiarCamara");

const staffStatus = document.getElementById("staffStatus");
const staffResumen = document.getElementById("staffResumen");
const staffControl = document.getElementById("staffControl");
const staffNombreInvitado = document.getElementById("staffNombreInvitado");
const staffCodigoInvitado = document.getElementById("staffCodigoInvitado");
const staffConfirmados = document.getElementById("staffConfirmados");
const staffUsados = document.getElementById("staffUsados");
const staffRestantes = document.getElementById("staffRestantes");
const staffEstadoAcceso = document.getElementById("staffEstadoAcceso");
const staffUltimoAcceso = document.getElementById("staffUltimoAcceso");
const staffUltimoValidadoPor = document.getElementById("staffUltimoValidadoPor");
const cantidadIngresoActual = document.getElementById("cantidadIngresoActual");
const staffHintCantidad = document.getElementById("staffHintCantidad");
const botonRestar = document.getElementById("botonRestar");
const botonSumar = document.getElementById("botonSumar");
const botonRegistrarAcceso = document.getElementById("botonRegistrarAcceso");
const staffValidadoPor = document.getElementById("staffValidadoPor");
const staffObservaciones = document.getElementById("staffObservaciones");

let datosAccesoActual = null;
let cantidadSeleccionada = 1;
let registrandoAcceso = false;
let scanner = null;
let camarasDisponibles = [];
let indiceCamaraActual = -1;
let modoCamaraActual = "environment";

function normalizarFechaStaff(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "-";

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) {
    return texto;
  }

  return fecha.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function mostrarEstadoStaff(texto, esError = false) {
  if (!staffStatus) return;

  staffStatus.textContent = texto;
  staffStatus.classList.toggle("is-error", esError);
  staffStatus.classList.toggle("is-success", !esError && texto !== "Cargando acceso...");
}

function mostrarEstadoPortada(texto, esError = false) {
  if (!staffStatusPortada) return;

  staffStatusPortada.textContent = texto;
  staffStatusPortada.classList.toggle("is-error", esError);
}

function obtenerIndiceCamaraInicial(cameras) {
  const prioridades = ["back", "rear", "environment", "trasera", "posterior"];
  const indiceTrasera = cameras.findIndex(function (camera) {
    const etiqueta = String(camera.label || "").toLowerCase();
    return prioridades.some(function (texto) {
      return etiqueta.includes(texto);
    });
  });

  if (indiceTrasera >= 0) return indiceTrasera;
  if (cameras.length > 1) return cameras.length - 1;
  return 0;
}

function actualizarBotonCambiarCamara() {
  if (!botonCambiarCamara) return;
  botonCambiarCamara.hidden = camarasDisponibles.length < 2;
}

function detenerEscanerQR() {
  const scannerActivo = scanner;
  scanner = null;

  const limpiarVista = function () {
    if (staffVideoContainer) staffVideoContainer.hidden = true;
    if (staffQrRegion) {
      staffQrRegion.innerHTML = "";
    }
  };

  if (!scannerActivo) {
    limpiarVista();
    return Promise.resolve();
  }

  return scannerActivo.stop().catch(function () {
    // ignorar errores al detener
  }).finally(limpiarVista);
}

function procesarToken(token) {
  if (!token) {
    mostrarEstadoPortada("Ingresa un token valido.", true);
    return;
  }

  let tokenReal = token;
  try {
    const url = new URL(token);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) {
      tokenReal = tokenParam;
    }
  } catch {
    // No es una URL, usar como esta
  }

  tokenGrupo = tokenReal;
  mostrarEstadoPortada("Cargando datos del grupo...");

  cargarAccesoGrupo().then(() => {
    if (staffPortada) staffPortada.hidden = true;
    if (staffPanel) staffPanel.hidden = false;
  }).catch(() => {
    // Error ya mostrado en cargarAccesoGrupo
  });
}

function iniciarScannerConCamara(cameraConfig) {
  scanner = new Html5Qrcode("staffQrRegion");

  return scanner.start(
    cameraConfig,
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    function (decodedText) {
      detenerEscanerQR();
      procesarToken(decodedText);
    },
    function () {
      // error de lectura periodica, se ignora
    }
  ).then(function () {
    if (typeof cameraConfig === "string") {
      const indiceEncontrado = camarasDisponibles.findIndex(function (camera) {
        return camera.id === cameraConfig;
      });

      if (indiceEncontrado >= 0) {
        indiceCamaraActual = indiceEncontrado;
        const etiqueta = String(camarasDisponibles[indiceCamaraActual].label || "").toLowerCase();
        modoCamaraActual = etiqueta.includes("front") || etiqueta.includes("user") || etiqueta.includes("frontal")
          ? "user"
          : "environment";
      }
    } else {
      modoCamaraActual = cameraConfig?.facingMode === "user" ? "user" : "environment";
      indiceCamaraActual = camarasDisponibles.findIndex(function (camera) {
        const etiqueta = String(camera.label || "").toLowerCase();
        if (modoCamaraActual === "user") {
          return etiqueta.includes("front") || etiqueta.includes("user") || etiqueta.includes("frontal");
        }

        return etiqueta.includes("back") || etiqueta.includes("rear") || etiqueta.includes("environment") || etiqueta.includes("trasera") || etiqueta.includes("posterior");
      });
    }

    mostrarEstadoPortada("Escaneando QR... Apunta la camara al codigo.");
  }).catch(function (error) {
    mostrarEstadoPortada("Error al iniciar la camara: " + error, true);
    if (staffVideoContainer) staffVideoContainer.hidden = true;
    if (staffQrRegion) {
      staffQrRegion.innerHTML = "";
    }
    scanner = null;
    throw error;
  });
}

function obtenerConfigCamaraInicial() {
  if (!camarasDisponibles.length) {
    return { facingMode: "environment" };
  }

  indiceCamaraActual = obtenerIndiceCamaraInicial(camarasDisponibles);
  const camaraInicial = camarasDisponibles[indiceCamaraActual];

  if (camaraInicial?.id) {
    return camaraInicial.id;
  }

  return { facingMode: "environment" };
}

function iniciarCamaraConFallback() {
  const configInicial = obtenerConfigCamaraInicial();

  return iniciarScannerConCamara(configInicial).catch(function () {
    if (modoCamaraActual === "user") {
      throw new Error("No fue posible iniciar ninguna camara.");
    }

    mostrarEstadoPortada("No se encontro camara trasera. Usando camara frontal...");
    indiceCamaraActual = camarasDisponibles.findIndex(function (camera) {
      const etiqueta = String(camera.label || "").toLowerCase();
      return etiqueta.includes("front") || etiqueta.includes("user") || etiqueta.includes("frontal");
    });

    const camaraFrontal = indiceCamaraActual >= 0 && camarasDisponibles[indiceCamaraActual]?.id
      ? camarasDisponibles[indiceCamaraActual].id
      : { facingMode: "user" };

    return iniciarScannerConCamara(camaraFrontal);
  });
}

function iniciarEscanerQR() {
  if (!staffQrRegion) {
    mostrarEstadoPortada("No se encontro el contenedor de QR.", true);
    return;
  }

  if (typeof Html5Qrcode === "undefined" || typeof Html5Qrcode.getCameras !== "function") {
    mostrarEstadoPortada("El escaner QR no se cargo correctamente.", true);
    return;
  }

  if (scanner) {
    detenerEscanerQR();
  }

  if (staffVideoContainer) staffVideoContainer.hidden = false;
  mostrarEstadoPortada("Buscando camara...", false);

  Html5Qrcode.getCameras().then(function (cameras) {
    if (!cameras || cameras.length === 0) {
      mostrarEstadoPortada("No se encontraron camaras.", true);
      return;
    }

    camarasDisponibles = cameras;
    actualizarBotonCambiarCamara();

    return iniciarCamaraConFallback();
  }).catch(function (e) {
    mostrarEstadoPortada("Error al acceder a la camara: " + (e?.message || e), true);
    if (staffVideoContainer) staffVideoContainer.hidden = true;
  });
}

function cambiarCamara() {
  if (!camarasDisponibles.length || camarasDisponibles.length < 2) return;

  const siguienteIndice = (indiceCamaraActual + 1) % camarasDisponibles.length;
  mostrarEstadoPortada("Cambiando camara...");
  indiceCamaraActual = siguienteIndice;

  detenerEscanerQR().finally(function () {
    if (staffVideoContainer) staffVideoContainer.hidden = false;
    iniciarScannerConCamara(camarasDisponibles[indiceCamaraActual].id);
  });
}

function iniciarRegistroManual() {
  const token = staffTokenManual?.value?.trim();
  procesarToken(token);
}

function actualizarStepper() {
  const restantes = datosAccesoActual?.accesosRestantes || 0;
  const cantidadMaxima = Math.max(restantes, 0);

  if (cantidadMaxima < 1) {
    cantidadSeleccionada = 0;
  } else if (cantidadSeleccionada < 1) {
    cantidadSeleccionada = 1;
  } else if (cantidadSeleccionada > cantidadMaxima) {
    cantidadSeleccionada = cantidadMaxima;
  }

  if (cantidadIngresoActual) {
    cantidadIngresoActual.textContent = String(cantidadSeleccionada);
  }

  if (staffHintCantidad) {
    staffHintCantidad.textContent = cantidadMaxima > 0
      ? `Puedes registrar hasta ${cantidadMaxima} acceso(s).`
      : "Este grupo ya no tiene accesos disponibles.";
  }

  if (botonRestar) {
    botonRestar.disabled = registrandoAcceso || cantidadSeleccionada <= 1;
  }

  if (botonSumar) {
    botonSumar.disabled = registrandoAcceso || cantidadSeleccionada >= cantidadMaxima;
  }

  if (botonRegistrarAcceso) {
    botonRegistrarAcceso.disabled = registrandoAcceso || cantidadMaxima < 1 || cantidadSeleccionada < 1;
  }
}

function renderizarAcceso(invitado) {
  datosAccesoActual = invitado;
  cantidadSeleccionada = invitado.accesosRestantes > 0 ? 1 : 0;

  if (staffNombreInvitado) staffNombreInvitado.textContent = invitado.nombre || "Invitado especial";
  if (staffCodigoInvitado) staffCodigoInvitado.textContent = invitado.codigo || "-";
  if (staffConfirmados) staffConfirmados.textContent = String(invitado.boletosConfirmados || 0);
  if (staffUsados) staffUsados.textContent = String(invitado.accesosUsados || 0);
  if (staffRestantes) staffRestantes.textContent = String(invitado.accesosRestantes || 0);
  if (staffEstadoAcceso) staffEstadoAcceso.textContent = invitado.estadoAcceso || "-";
  if (staffUltimoAcceso) staffUltimoAcceso.textContent = normalizarFechaStaff(invitado.ultimoAcceso);
  if (staffUltimoValidadoPor) staffUltimoValidadoPor.textContent = invitado.ultimoValidadoPor || "-";
  if (staffResumen) staffResumen.hidden = false;
  if (staffControl) staffControl.hidden = false;

  actualizarStepper();
}

function construirUrlStaff(action, extraParams = {}) {
  const query = new URLSearchParams({
    action,
    token: tokenGrupo,
    ...extraParams
  });

  return `${staffApiEndpoint}?${query.toString()}`;
}

function cargarAccesoGrupo() {
  if (!staffApiEndpoint) {
    mostrarEstadoStaff("Falta configurar el endpoint del Apps Script.", true);
    return Promise.resolve();
  }

  if (!tokenGrupo) {
    mostrarEstadoStaff("Falta el token del grupo en la URL.", true);
    return Promise.resolve();
  }

  mostrarEstadoStaff("Cargando acceso...");

  return fetch(construirUrlStaff("consultarAccesoPorToken"), {
    method: "GET",
    cache: "no-store"
  })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo consultar el acceso");
      return response.json();
    })
    .then((payload) => {
      if (!payload?.ok || !payload?.invitado) {
        throw new Error(payload?.message || "No se pudo cargar el acceso");
      }

      renderizarAcceso(payload.invitado);
      mostrarEstadoStaff("Acceso listo para validacion.");
    })
    .catch((error) => {
      if (staffResumen) staffResumen.hidden = true;
      if (staffControl) staffControl.hidden = true;
      mostrarEstadoStaff(error.message || "Ocurrio un error al cargar el acceso.", true);
    });
}

function registrarAcceso() {
  if (!datosAccesoActual || registrandoAcceso) return;
  if (!staffApiEndpoint) {
    mostrarEstadoStaff("Falta configurar el endpoint del Apps Script.", true);
    return;
  }

  const validadoPor = String(staffValidadoPor?.value || "").trim() || "STAFF";
  const observaciones = String(staffObservaciones?.value || "").trim();

  registrandoAcceso = true;
  actualizarStepper();
  mostrarEstadoStaff("Registrando entrada...");

  fetch(staffApiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams({
      action: "registrarAcceso",
      token: tokenGrupo,
      ingresan: String(cantidadSeleccionada),
      validadoPor,
      observaciones
    }).toString()
  })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo registrar el acceso");
      return response.json();
    })
    .then((payload) => {
      if (!payload?.ok) {
        throw new Error(payload?.message || "No se pudo registrar el acceso");
      }

      if (staffObservaciones) {
        staffObservaciones.value = "";
      }

      mostrarEstadoStaff(payload.message || "Acceso registrado correctamente.");
      return cargarAccesoGrupo();
    })
    .catch((error) => {
      mostrarEstadoStaff(error.message || "Ocurrio un error al registrar el acceso.", true);
    })
    .finally(() => {
      registrandoAcceso = false;
      actualizarStepper();
    });
}

if (botonRestar) {
  botonRestar.addEventListener("click", () => {
    cantidadSeleccionada = Math.max(cantidadSeleccionada - 1, 1);
    actualizarStepper();
  });
}

if (botonSumar) {
  botonSumar.addEventListener("click", () => {
    const restantes = datosAccesoActual?.accesosRestantes || 0;
    cantidadSeleccionada = Math.min(cantidadSeleccionada + 1, restantes);
    actualizarStepper();
  });
}

if (botonRegistrarAcceso) {
  botonRegistrarAcceso.addEventListener("click", registrarAcceso);
}

if (botonEscanearQR) {
  botonEscanearQR.addEventListener("click", iniciarEscanerQR);
}

if (botonDetenerEscaner) {
  botonDetenerEscaner.addEventListener("click", detenerEscanerQR);
}

if (botonCambiarCamara) {
  botonCambiarCamara.addEventListener("click", cambiarCamara);
}

if (botonIniciarRegistro) {
  botonIniciarRegistro.addEventListener("click", iniciarRegistroManual);
}

if (staffTokenManual) {
  staffTokenManual.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      iniciarRegistroManual();
    }
  });
}

if (tokenGrupo) {
  if (staffPortada) staffPortada.hidden = true;
  if (staffPanel) staffPanel.hidden = false;
  cargarAccesoGrupo();
} else {
  if (staffPortada) staffPortada.hidden = false;
  if (staffPanel) staffPanel.hidden = true;
}
