const staffApiEndpoint = document.body?.dataset.apiEndpoint?.trim() || "";
const staffParams = new URLSearchParams(window.location.search);
let tokenGrupo = (staffParams.get("token") || "").trim();

const staffLanding = document.getElementById("staffLanding");
const staffShell = document.querySelector(".staff-shell");
const botonIniciarGestion = document.getElementById("botonIniciarGestion");
const staffLandingMode = document.getElementById("staffLandingMode");
const staffLandingName = document.getElementById("staffLandingName");
const staffLandingDate = document.getElementById("staffLandingDate");
const staffPortada = document.getElementById("staffPortada");
const staffPanel = document.getElementById("staffPanel");
const botonEscanearQR = document.getElementById("botonEscanearQR");
const staffTokenManual = document.getElementById("staffTokenManual");
const botonIniciarRegistro = document.getElementById("botonIniciarRegistro");
const staffStatusPortada = document.getElementById("staffStatusPortada");
const staffPortadaCopy = document.getElementById("staffPortadaCopy");
const staffVideoContainer = document.getElementById("staffVideoContainer");
const staffQrRegion = document.getElementById("staffQrRegion");
const botonDetenerEscaner = document.getElementById("botonDetenerEscaner");
const botonCambiarCamara = document.getElementById("botonCambiarCamara");

const staffStatus = document.getElementById("staffStatus");
const staffPanelCopy = document.getElementById("staffPanelCopy");
const staffSuccessCard = document.getElementById("staffSuccessCard");
const staffSuccessTitle = document.getElementById("staffSuccessTitle");
const staffSuccessCopy = document.getElementById("staffSuccessCopy");
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
const botonEscanearNuevoQr = document.getElementById("botonEscanearNuevoQr");
const botonVolverAlGrupo = document.getElementById("botonVolverAlGrupo");

let datosAccesoActual = null;
let cantidadSeleccionada = 1;
let registrandoAcceso = false;
let scanner = null;
let camarasDisponibles = [];
let indiceCamaraActual = -1;
let modoCamaraActual = "environment";
let escanerEnTransicion = false;

const staffEventConfig = {
  name: document.body?.dataset.eventName?.trim() || "Evento sin nombre",
  date: document.body?.dataset.eventDate?.trim() || "Fecha pendiente",
  mode: document.body?.dataset.eventMode?.trim() || "Registro de accesos"
};

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

function recortarToken(token) {
  const limpio = String(token || "").trim();
  if (!limpio) return "Sin token";
  if (limpio.length <= 10) return limpio;
  return `${limpio.slice(0, 4)}...${limpio.slice(-4)}`;
}

function actualizarContextoStaff() {
  if (staffLandingMode) {
    staffLandingMode.textContent = staffEventConfig.mode;
  }

  if (staffLandingName) {
    staffLandingName.textContent = staffEventConfig.name;
  }

  if (staffLandingDate) {
    staffLandingDate.textContent = staffEventConfig.date;
  }

  const hayTokenInicial = Boolean(tokenGrupo);

  if (staffPortadaCopy) {
    staffPortadaCopy.textContent = hayTokenInicial
      ? `Esta sesion ya abrio con una invitacion lista: ${recortarToken(tokenGrupo)}. Puedes validar el acceso de inmediato o cambiar a otro grupo.`
      : `Escanea el QR del pase o ingresa el token para validar el ingreso en vivo de ${staffEventConfig.name}.`;
  }

  if (staffPanelCopy) {
    staffPanelCopy.textContent = hayTokenInicial
      ? `Gestionando accesos para ${staffEventConfig.name}. Esta vista ya cargo una invitacion y el registro se descuenta en vivo desde la hoja.`
      : `Escanea o abre el QR del grupo. El registro se descuenta en vivo desde la hoja para ${staffEventConfig.name}.`;
  }
}

function limpiarAccesoActual() {
  datosAccesoActual = null;
  cantidadSeleccionada = 0;

  if (staffNombreInvitado) staffNombreInvitado.textContent = "-";
  if (staffCodigoInvitado) staffCodigoInvitado.textContent = "-";
  if (staffConfirmados) staffConfirmados.textContent = "0";
  if (staffUsados) staffUsados.textContent = "0";
  if (staffRestantes) staffRestantes.textContent = "0";
  if (staffEstadoAcceso) staffEstadoAcceso.textContent = "-";
  if (staffUltimoAcceso) staffUltimoAcceso.textContent = "-";
  if (staffUltimoValidadoPor) staffUltimoValidadoPor.textContent = "-";
  if (staffResumen) staffResumen.hidden = true;
  if (staffControl) staffControl.hidden = true;

  actualizarStepper();
}

function aplicarRegistroExitosoLocalmente() {
  if (!datosAccesoActual) return;

  const accesosRegistrados = cantidadSeleccionada;
  const usadosActuales = Number(datosAccesoActual.accesosUsados || 0);
  const restantesActuales = Number(datosAccesoActual.accesosRestantes || 0);

  datosAccesoActual.accesosUsados = usadosActuales + accesosRegistrados;
  datosAccesoActual.accesosRestantes = Math.max(restantesActuales - accesosRegistrados, 0);
  datosAccesoActual.ultimoAcceso = new Date().toISOString();
  datosAccesoActual.ultimoValidadoPor = String(staffValidadoPor?.value || "").trim() || "STAFF";
  datosAccesoActual.estadoAcceso = datosAccesoActual.accesosRestantes > 0 ? "DISPONIBLE" : "COMPLETO";
}

function ocultarConfirmacionAcceso() {
  if (staffSuccessCard) {
    staffSuccessCard.hidden = true;
  }
}

function mostrarConfirmacionAcceso(mensaje) {
  if (staffSuccessTitle) {
    staffSuccessTitle.textContent = "Entrada registrada";
  }

  if (staffSuccessCopy) {
    const nombre = datosAccesoActual?.nombre || "este grupo";
    const textoOperacion = cantidadSeleccionada === 1
      ? "1 acceso"
      : `${cantidadSeleccionada} accesos`;
    staffSuccessCopy.textContent = mensaje || `${textoOperacion} registrado para ${nombre}.`;
  }

  if (staffResumen) {
    staffResumen.hidden = true;
  }

  if (staffControl) {
    staffControl.hidden = true;
  }

  if (staffSuccessCard) {
    staffSuccessCard.hidden = false;
  }
}

function prepararNuevoEscaneo() {
  detenerEscanerQR();
  tokenGrupo = "";
  limpiarAccesoActual();
  ocultarConfirmacionAcceso();
  actualizarContextoStaff();
  mostrarEstadoStaff("Escanea un nuevo QR para continuar.");
  mostrarEstadoPortada("Listo para escanear el siguiente acceso.");
  mostrarPantallaGestion();

  if (staffTokenManual) {
    staffTokenManual.value = "";
  }

  if (staffObservaciones) {
    staffObservaciones.value = "";
  }

  if (staffPortada) {
    staffPortada.hidden = false;
    staffPortada.style.display = "block";
  }

  if (staffPanel) {
    staffPanel.hidden = true;
    staffPanel.style.display = "none";
  }
}

function mostrarPantallaGestion() {
  if (staffShell) {
    staffShell.classList.add("is-operational");
  }

  if (staffLanding) {
    staffLanding.hidden = true;
    staffLanding.style.display = "none";
  }

  if (staffPortada) {
    staffPortada.hidden = false;
    staffPortada.style.display = "block";
  }

  if (staffPanel) {
    staffPanel.hidden = true;
    staffPanel.style.display = "none";
  }
}

function mostrarPantallaInicio() {
  if (staffShell) {
    staffShell.classList.remove("is-operational");
  }

  if (staffLanding) {
    staffLanding.hidden = false;
    staffLanding.style.display = "grid";
  }

  if (staffPortada) {
    staffPortada.hidden = true;
    staffPortada.style.display = "none";
  }

  if (staffPanel) {
    staffPanel.hidden = true;
    staffPanel.style.display = "none";
  }
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
  botonCambiarCamara.disabled = escanerEnTransicion || camarasDisponibles.length < 2;
}

function actualizarControlesEscaner() {
  if (botonEscanearQR) {
    botonEscanearQR.disabled = escanerEnTransicion;
  }

  if (botonDetenerEscaner) {
    botonDetenerEscaner.disabled = escanerEnTransicion && !scanner;
  }

  actualizarBotonCambiarCamara();
}

function detenerEscanerQR(mostrarMensaje = true) {
  if (escanerEnTransicion) {
    return Promise.resolve();
  }

  escanerEnTransicion = true;
  actualizarControlesEscaner();

  const scannerActivo = scanner;
  scanner = null;

  const limpiarVista = function () {
    if (staffVideoContainer) {
      staffVideoContainer.hidden = true;
      staffVideoContainer.style.display = "none";
    }
    if (staffQrRegion) {
      staffQrRegion.innerHTML = "";
    }
    if (mostrarMensaje) {
      mostrarEstadoPortada("Camara cerrada. Puedes volver a escanear cuando quieras.");
    }
  };

  if (!scannerActivo) {
    limpiarVista();
    escanerEnTransicion = false;
    actualizarControlesEscaner();
    return Promise.resolve();
  }

  return scannerActivo.stop().catch(function () {
    // ignorar errores al detener
  }).finally(function () {
    limpiarVista();
    escanerEnTransicion = false;
    actualizarControlesEscaner();
  });
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
  limpiarAccesoActual();
  ocultarConfirmacionAcceso();
  actualizarContextoStaff();
  mostrarEstadoPortada("Cargando datos del grupo...");
  mostrarPantallaGestion();

  cargarAccesoGrupo().then(() => {
    if (staffPortada) {
      staffPortada.hidden = true;
      staffPortada.style.display = "none";
    }
    if (staffPanel) {
      staffPanel.hidden = false;
      staffPanel.style.display = "block";
    }
  }).catch(() => {
    if (staffPortada) {
      staffPortada.hidden = false;
      staffPortada.style.display = "block";
    }
    if (staffPanel) {
      staffPanel.hidden = true;
      staffPanel.style.display = "none";
    }
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
      detenerEscanerQR(false);
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
  if (escanerEnTransicion || scanner) {
    return;
  }

  if (!staffQrRegion) {
    mostrarEstadoPortada("No se encontro el contenedor de QR.", true);
    return;
  }

  if (typeof Html5Qrcode === "undefined" || typeof Html5Qrcode.getCameras !== "function") {
    mostrarEstadoPortada("El escaner QR no se cargo correctamente.", true);
    return;
  }

  escanerEnTransicion = true;
  actualizarControlesEscaner();

  if (staffVideoContainer) {
    staffVideoContainer.hidden = false;
    staffVideoContainer.style.display = "block";
  }
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
    if (staffVideoContainer) {
      staffVideoContainer.hidden = true;
      staffVideoContainer.style.display = "none";
    }
  }).finally(function () {
    escanerEnTransicion = false;
    actualizarControlesEscaner();
  });
}

function cambiarCamara() {
  if (!camarasDisponibles.length || camarasDisponibles.length < 2 || escanerEnTransicion) return;

  const siguienteIndice = (indiceCamaraActual + 1) % camarasDisponibles.length;
  mostrarEstadoPortada("Cambiando camara...");
  indiceCamaraActual = siguienteIndice;

  detenerEscanerQR().finally(function () {
    if (staffVideoContainer) {
      staffVideoContainer.hidden = false;
      staffVideoContainer.style.display = "block";
    }
    iniciarScannerConCamara(camarasDisponibles[indiceCamaraActual].id);
  });
}

function iniciarRegistroManual() {
  const token = staffTokenManual?.value?.trim();
  procesarToken(token);
}

function actualizarStepper() {
  if (!datosAccesoActual) {
    if (cantidadIngresoActual) {
      cantidadIngresoActual.textContent = "0";
    }

    if (staffHintCantidad) {
      staffHintCantidad.textContent = "Escanea un QR valido para habilitar el registro.";
    }

    if (botonRestar) {
      botonRestar.disabled = true;
    }

    if (botonSumar) {
      botonSumar.disabled = true;
    }

    if (botonRegistrarAcceso) {
      botonRegistrarAcceso.disabled = true;
    }

    return;
  }

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
    return Promise.reject(new Error("Falta configurar el endpoint del Apps Script."));
  }

  if (!tokenGrupo) {
    mostrarEstadoStaff("Falta el token del grupo en la URL.", true);
    return Promise.reject(new Error("Falta el token del grupo en la URL."));
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
      actualizarContextoStaff();
      mostrarEstadoStaff("Acceso listo para validacion.");
    })
    .catch((error) => {
      limpiarAccesoActual();
      mostrarEstadoStaff(error.message || "Ocurrio un error al cargar el acceso.", true);
      throw error;
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

      aplicarRegistroExitosoLocalmente();
      mostrarEstadoStaff(payload.message || "Acceso registrado correctamente.");
      mostrarConfirmacionAcceso(payload.message);
      return null;
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

if (botonIniciarGestion) {
  botonIniciarGestion.addEventListener("click", mostrarPantallaGestion);
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

if (botonEscanearNuevoQr) {
  botonEscanearNuevoQr.addEventListener("click", function () {
    prepararNuevoEscaneo();
    iniciarEscanerQR();
  });
}

if (botonVolverAlGrupo) {
  botonVolverAlGrupo.addEventListener("click", function () {
    ocultarConfirmacionAcceso();
    cargarAccesoGrupo().catch(function () {
      if (staffResumen) {
        staffResumen.hidden = false;
      }
      if (staffControl) {
        staffControl.hidden = false;
      }
      actualizarStepper();
    });
  });
}

if (staffTokenManual) {
  staffTokenManual.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      iniciarRegistroManual();
    }
  });
}

actualizarContextoStaff();
limpiarAccesoActual();
ocultarConfirmacionAcceso();
actualizarControlesEscaner();

if (tokenGrupo) {
  mostrarPantallaGestion();
  if (staffPortada) {
    staffPortada.hidden = true;
    staffPortada.style.display = "none";
  }
  if (staffPanel) {
    staffPanel.hidden = false;
    staffPanel.style.display = "block";
  }
  cargarAccesoGrupo().catch(() => {
    if (staffPortada) {
      staffPortada.hidden = false;
      staffPortada.style.display = "block";
    }
    if (staffPanel) {
      staffPanel.hidden = true;
      staffPanel.style.display = "none";
    }
  });
} else {
  mostrarPantallaInicio();
}
