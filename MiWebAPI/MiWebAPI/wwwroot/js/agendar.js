// Agendar cita: perfil del médico (sp_perfilMedico), horarios libres (sp_SlotsDisponibles)
// y reservación (sp_crearCita). Requiere js/auth.js.
// URL: agendar-cita.html?medico=<id>[&fecha=aaaa-mm-dd][&reprogramar=<idCita>]
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const parametros = new URLSearchParams(location.search);
const medicoId = parametros.get("medico");
const citaAReprogramar = parametros.get("reprogramar");

let medico = null;
let diasQueAtiende = new Set();     // 1 = lunes ... 7 = domingo
let mesVisible = new Date();
mesVisible.setDate(1);
let fechaSeleccionada = null;       // "aaaa-mm-dd"
let slotSeleccionado = null;        // { consultorioId, fechaHora, hora, duracionMin }

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll("[data-ir-paso]").forEach((a) =>
        a.addEventListener("click", (e) => { e.preventDefault(); irAPaso(Number(a.dataset.irPaso)); }));
    document.getElementById("btnMesAnterior").addEventListener("click", () => cambiarMes(-1));
    document.getElementById("btnMesSiguiente").addEventListener("click", () => cambiarMes(1));
    document.getElementById("btnConfirmarFinal").addEventListener("click", confirmarCita);

    if (citaAReprogramar) document.getElementById("avisoReprogramar").classList.remove("d-none");

    if (!medicoId) {
        mostrarMensaje("No se indicó el médico. Elige uno desde el inicio.", "warning");
        document.getElementById("subtituloMedico").textContent = "";
        renderizarCalendario();
        return;
    }

    document.getElementById("lnkCancelar").href = citaAReprogramar
        ? "dashboard.html"
        : `perfil-medico.html?id=${encodeURIComponent(medicoId)}`;

    await cargarMedico();
    renderizarCalendario();

    // Si viene una fecha desde el buscador del inicio, se abre directo
    const fechaInicial = parametros.get("fecha");
    if (fechaInicial && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicial) && fechaDisponible(fechaLocal(fechaInicial))) {
        const f = fechaLocal(fechaInicial);
        mesVisible = new Date(f.getFullYear(), f.getMonth(), 1);
        seleccionarDia(f);
    }
});

// ---------- Médico ----------
async function cargarMedico() {
    try {
        medico = await apiFetch(`/api/doctores/${encodeURIComponent(medicoId)}/perfil`);
    } catch (error) {
        mostrarMensaje(error.status === 404 ? "Este médico no existe o todavía no está aprobado." : error.message, "danger");
        document.getElementById("subtituloMedico").textContent = "";
        return;
    }

    const nombre = `Dr. ${medico.nombre ?? ""} ${medico.apellido ?? ""}`.trim();
    const especialidad = medico.especialidad ?? "Medicina general";
    document.title = `Agendar con ${nombre} | vitaGo`;
    document.getElementById("subtituloMedico").innerHTML =
        `Confirma tu cita con <span class="fw-bold text-dark">${escaparHtml(nombre)}</span> • ${escaparHtml(especialidad)}`;
    document.getElementById("nombreMedico").textContent = nombre;
    document.getElementById("badgeVerificado").classList.toggle("d-none", !medico.verificado);
    document.getElementById("especialidadMedico").textContent =
        especialidad + (medico.aniosExperiencia > 0 ? ` • ${medico.aniosExperiencia} años exp.` : "");
    document.getElementById("ratingMedico").innerHTML = medico.rating != null
        ? `⭐ ${Number(medico.rating).toFixed(1)} <span class="text-muted">(${medico.totalResenas})</span>`
        : '<span class="text-muted">Sin reseñas todavía</span>';
    document.getElementById("precioMedico").textContent = formatoMoneda(medico.precioConsulta);

    const c = medico.consultorios?.[0];
    document.getElementById("lugarMedico").textContent = c
        ? `📍 ${[c.nombre, c.direccion, c.ciudad].filter(Boolean).join(" • ")}`
        : "💻 Solo videoconsulta";

    const foto = document.getElementById("fotoMedico");
    if (medico.fotoUrl) {
        const img = document.createElement("img");
        img.src = medico.fotoUrl;
        img.alt = nombre;
        img.style.cssText = "width:100%; height:100%; object-fit:cover;";
        img.onerror = () => { foto.textContent = inicialesDe(`${medico.nombre} ${medico.apellido}`); };
        foto.replaceChildren(img);
    } else {
        foto.textContent = inicialesDe(`${medico.nombre} ${medico.apellido}`);
    }

    // Modalidad: video solo si el médico la ofrece; presencial solo si tiene consultorio
    const video = document.querySelector('#modalidad option[value="video"]');
    const presencial = document.querySelector('#modalidad option[value="presencial"]');
    video.disabled = !medico.consultaOnline;
    video.textContent = medico.consultaOnline ? "Videoconsulta" : "Videoconsulta (no disponible con este médico)";
    if (!c) { presencial.disabled = true; document.getElementById("modalidad").value = "video"; }

    diasQueAtiende = new Set((medico.horarios ?? []).map((h) => h.diaSemana));
}

// ---------- Pasos ----------
function irAPaso(paso) {
    document.querySelectorAll(".paso-carrusel").forEach((p) => p.classList.remove("activo"));
    document.getElementById(`paso-${paso}`).classList.add("activo");

    const titulos = { 1: "Selecciona una fecha", 2: "Elige la hora", 3: "Confirma tu cita" };
    document.getElementById("titulo-paso").textContent = titulos[paso];

    const activo = "badge bg-success rounded-circle p-2";
    const inactivo = "badge bg-secondary-subtle text-secondary rounded-circle p-2";
    document.getElementById("badge-paso-2").className = paso >= 2 ? activo : inactivo;
    document.getElementById("barra-progreso-2").style.width = paso >= 3 ? "100%" : paso === 2 ? "50%" : "0%";
    document.getElementById("badge-paso-3").className = paso >= 3 ? activo : inactivo;
}

// ---------- Calendario ----------
function cambiarMes(delta) {
    mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + delta, 1);
    renderizarCalendario();
}

function diaSemanaIso(fecha) {
    const d = fecha.getDay();          // 0 = domingo
    return d === 0 ? 7 : d;
}

function fechaDisponible(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha >= hoy && (diasQueAtiende.size === 0 ? !!medico : diasQueAtiende.has(diaSemanaIso(fecha)));
}

function aIso(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function renderizarCalendario() {
    const contenedor = document.getElementById("diasCalendario");
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    document.getElementById("nombreMesEtiqueta").textContent = `${MESES[mes]} ${anio}`;

    // No tiene caso ir a meses pasados
    const hoy = new Date();
    document.getElementById("btnMesAnterior").disabled =
        anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes <= hoy.getMonth());

    contenedor.innerHTML = "";
    const huecos = diaSemanaIso(new Date(anio, mes, 1)) - 1;
    for (let i = 0; i < huecos; i++) contenedor.appendChild(celda());

    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    for (let dia = 1; dia <= ultimoDia; dia++) {
        const fecha = new Date(anio, mes, dia);
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn btn-sm w-100 rounded py-2 btn-cristal-item";
        boton.textContent = dia;

        if (!fechaDisponible(fecha)) {
            boton.disabled = true;
        } else {
            if (fechaSeleccionada === aIso(fecha)) boton.classList.add("activo");
            boton.addEventListener("click", () => seleccionarDia(fecha));
        }
        const c = celda();
        c.style.marginBottom = "8px";
        c.appendChild(boton);
        contenedor.appendChild(c);
    }
}

function celda() {
    const div = document.createElement("div");
    div.style.flex = "0 0 14.28%";
    div.style.maxWidth = "14.28%";
    return div;
}

async function seleccionarDia(fecha) {
    fechaSeleccionada = aIso(fecha);
    slotSeleccionado = null;
    const texto = `${fecha.getDate()} de ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    document.getElementById("etiquetaFechaSeleccionada").textContent = "Día elegido: " + texto;
    document.getElementById("resumen-fecha").textContent = `📅 ${texto}`;
    document.getElementById("resumen-hora").textContent = "";
    document.getElementById("resumen-seleccion").style.display = "block";
    renderizarCalendario();

    setTimeout(() => irAPaso(2), 300);
    await cargarHorarios();
}

// ---------- Horarios ----------
async function cargarHorarios() {
    const contenedor = document.getElementById("contenedorHorarios");
    contenedor.innerHTML = '<p class="text-muted small mb-0">Buscando horarios libres...</p>';

    let slots;
    try {
        slots = await apiFetch(`/api/doctores/${encodeURIComponent(medicoId)}/slots?fecha=${fechaSeleccionada}`);
    } catch (error) {
        contenedor.innerHTML = `<p class="text-danger small mb-0">${escaparHtml(error.message)}</p>`;
        return;
    }

    // Si es hoy, se ocultan las horas que ya pasaron
    const ahora = new Date();
    slots = slots.filter((s) => fechaLocal(s.fechaHora) > ahora);

    if (slots.length === 0) {
        contenedor.innerHTML = '<p class="text-muted small mb-0">No hay horarios libres este día. Elige otro día en el calendario.</p>';
        return;
    }

    contenedor.replaceChildren(...slots.map((slot) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "btn btn-sm px-4 py-2 horario-chip btn-cristal-item";
        chip.textContent = formatoHora(slot.fechaHora);
        chip.addEventListener("click", () => {
            contenedor.querySelectorAll(".horario-chip").forEach((c) => c.classList.remove("activo"));
            chip.classList.add("activo");
            slotSeleccionado = slot;
            document.getElementById("resumen-hora").textContent = `⏱️ ${slot.hora} hrs • ${slot.duracionMin} min`;
            setTimeout(() => irAPaso(3), 300);
        });
        return chip;
    }));
}

// ---------- Confirmar ----------
async function confirmarCita() {
    if (!slotSeleccionado) { irAPaso(fechaSeleccionada ? 2 : 1); return; }

    // Para reservar hay que ser paciente con sesión iniciada
    const usuario = obtenerUsuario();
    if (!usuario) {
        mostrarMensaje("Inicia sesión para confirmar tu cita. Te regresaremos aquí.", "info");
        setTimeout(irALogin, 1200);
        return;
    }
    if (usuario.rol !== "paciente") {
        mostrarMensaje("Solo las cuentas de paciente pueden agendar citas.", "warning");
        return;
    }

    const boton = document.getElementById("btnConfirmarFinal");
    boton.disabled = true;
    boton.textContent = "Reservando...";

    const modalidad = document.getElementById("modalidad").value;
    try {
        const resultado = await apiFetch("/api/citas", {
            method: "POST",
            body: {
                medicoId,
                consultorioId: modalidad === "presencial" ? slotSeleccionado.consultorioId : null,
                fechaHora: slotSeleccionado.fechaHora,
                modalidad,
                motivo: document.getElementById("motivo").value.trim() || null
            }
        });

        // Reprogramar = nueva cita reservada + cancelar la anterior
        if (citaAReprogramar) {
            try {
                await apiFetch(`/api/citas/${encodeURIComponent(citaAReprogramar)}/cancelar`, { method: "POST" });
            } catch (error) {
                sessionStorage.setItem("vitago_aviso", `Tu nueva cita quedó reservada, pero no se pudo cancelar la anterior: ${error.message}`);
            }
        }

        window.location.href = `confirmacion.html?id=${encodeURIComponent(resultado.idCita)}`;
    } catch (error) {
        // 409 = alguien ganó ese horario; se recargan los horarios
        mostrarMensaje(error.message, error.status === 409 ? "warning" : "danger");
        if (error.status === 409) { irAPaso(2); cargarHorarios(); }
        boton.disabled = false;
        boton.textContent = "Confirmar mi cita ✔️";
    }
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensaje");
    caja.textContent = texto;
    caja.className = `alert alert-${tipo}`;
    caja.scrollIntoView({ behavior: "smooth", block: "center" });
}
