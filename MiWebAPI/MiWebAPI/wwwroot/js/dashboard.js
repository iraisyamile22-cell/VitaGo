// Panel del paciente: GET /api/citas (sp_citasPaciente) y POST /api/citas/{id}/cancelar (sp_cancelarCita).
// Requiere js/auth.js.
const usuarioPanel = requerirSesion("paciente");
const CITAS_INICIALES = 5;
let citas = [];
let citasResenadas = new Set();   // ids de citas que ya calificó (GET /api/citas/resenadas)
let verTodas = false;

const ETIQUETAS_ESTADO = {
    confirmada: ["Confirmada", "bg-success-subtle text-success border-success-subtle"],
    pendiente: ["Pendiente", "bg-warning-subtle text-warning-emphasis border-warning-subtle"],
    completada: ["Completada", "bg-light text-success"],
    cancelada: ["Cancelada", "bg-danger-subtle text-danger border-danger-subtle"],
    no_asistio: ["No asistió", "bg-secondary-subtle text-secondary"]
};

document.addEventListener("DOMContentLoaded", () => {
    if (!usuarioPanel) return;
    document.getElementById("saludoPanel").textContent = `${saludoSegunHora()}, ${nombreParaMostrar(usuarioPanel)}`;

    document.getElementById("lnkVerTodas").addEventListener("click", (e) => {
        e.preventDefault();
        verTodas = !verTodas;
        pintarHistorial();
    });

    // Botones de cada cita del historial (delegación de eventos)
    document.getElementById("listaHistorial").addEventListener("click", (e) => {
        const boton = e.target.closest("[data-cancelar]");
        if (boton) cancelarCita(boton.dataset.cancelar);
    });

    cargarCitas();
});

function esFutura(c) {
    return fechaLocal(c.fechaHora) > new Date();
}

function esActiva(c) {
    return ["confirmada", "pendiente"].includes(c.estado) && esFutura(c);
}

async function cargarCitas() {
    try {
        citas = await apiFetch("/api/citas");
        try {
            citasResenadas = new Set((await apiFetch("/api/citas/resenadas")).map((x) => String(x).toLowerCase()));
        } catch { citasResenadas = new Set(); }   // si falla, solo no se ofrece "Calificar"
    } catch (error) {
        mostrarMensaje(error.message, "danger");
        document.getElementById("subtituloPanel").textContent = "";
        document.getElementById("proximaCita").innerHTML = "";
        document.getElementById("listaHistorial").innerHTML = "";
        return;
    }

    const proximas = citas.filter(esActiva).sort((a, b) => fechaLocal(a.fechaHora) - fechaLocal(b.fechaHora));
    const realizadas = citas.filter((c) => c.estado === "completada" || (c.estado === "confirmada" && !esFutura(c)));
    document.getElementById("numProximas").textContent = proximas.length;
    document.getElementById("numRealizadas").textContent = realizadas.length;
    document.getElementById("numCanceladas").textContent = citas.filter((c) => c.estado === "cancelada").length;

    pintarProxima(proximas[0]);
    pintarHistorial();
}

function cuandoEs(fechaHora) {
    const f = fechaLocal(fechaHora);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(f); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((dia - hoy) / 86400000);
    const hora = formatoHora(fechaHora);
    if (dias === 0) return `Hoy • ${hora}`;
    if (dias === 1) return `Mañana • ${hora}`;
    return `${f.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} • ${hora}`;
}

function pintarProxima(c) {
    const caja = document.getElementById("proximaCita");
    const acciones = document.getElementById("accionesProxima");

    if (!c) {
        document.getElementById("tituloPanel").textContent = "No tienes citas próximas.";
        document.getElementById("subtituloPanel").textContent = "Busca un especialista y agenda tu próxima revisión.";
        acciones.classList.add("d-none");
        caja.innerHTML = `
            <p class="text-muted small mb-3">Aún no tienes ninguna cita agendada.</p>
            <a href="index.html#medicos" class="btn btn-primary btn-sm px-4">Buscar especialista</a>`;
        return;
    }

    const dias = Math.round((fechaLocal(c.fechaHora) - new Date()) / 86400000);
    document.getElementById("tituloPanel").textContent = "Ya tienes todo listo para tu próxima revisión médica.";
    document.getElementById("subtituloPanel").textContent = dias <= 0
        ? "Tu próxima cita es hoy. Revisa los detalles."
        : `Tu próxima cita es en ${dias} día${dias === 1 ? "" : "s"}. Revisa los detalles o modifícala.`;

    const [estado, clase] = ETIQUETAS_ESTADO[c.estado] ?? [c.estado, "bg-light text-secondary"];
    const lugar = c.modalidad === "video" ? "💻 Videoconsulta" : [c.consultorio, c.ciudad].filter(Boolean).join(", ");

    caja.innerHTML = `
        <div class="row align-items-center">
            <div class="col-md-8">
                <p class="text-muted small mb-1 text-capitalize">${escaparHtml(cuandoEs(c.fechaHora))}</p>
                <h4 class="fw-bold text-dark mb-1">Dr. ${escaparHtml(c.doctor)}</h4>
                <p class="text-secondary small mb-2">${escaparHtml(lugar)}</p>
                <span class="badge border px-2 py-1 ${clase}">${escaparHtml(estado)}</span>
                <span class="text-muted x-small ms-2">Folio ${escaparHtml(c.folio)}</span>
            </div>
            <div class="col-md-4 text-md-end mt-3 mt-md-0">
                <div class="text-muted small">Especialidad: <span class="fw-bold text-dark">${escaparHtml(c.especialidad ?? "Medicina general")}</span></div>
                <div class="text-muted small mb-3">Duración: <span class="fw-bold text-dark">${c.duracionMin} min</span></div>
                <a href="confirmacion.html?id=${encodeURIComponent(c.id)}" class="btn btn-primary btn-sm px-4">Ver detalles</a>
            </div>
        </div>`;

    acciones.classList.remove("d-none");
    document.getElementById("btnCancelarProxima").onclick = () => cancelarCita(c.id);
    document.getElementById("btnReprogramar").onclick = () => {
        window.location.href = `agendar-cita.html?medico=${encodeURIComponent(c.medicoId)}&reprogramar=${encodeURIComponent(c.id)}`;
    };
}

function pintarHistorial() {
    const lista = document.getElementById("listaHistorial");
    const lnk = document.getElementById("lnkVerTodas");

    if (citas.length === 0) {
        lista.innerHTML = '<p class="text-muted small mb-0">Aquí aparecerán tus citas cuando agendes la primera.</p>';
        lnk.classList.add("d-none");
        return;
    }

    // sp_citasPaciente ya viene de la más reciente a la más antigua
    const visibles = verTodas ? citas : citas.slice(0, CITAS_INICIALES);
    lista.innerHTML = visibles.map((c) => {
        const [estado, clase] = ETIQUETAS_ESTADO[c.estado] ?? [c.estado, "bg-light text-secondary"];
        const fecha = fechaLocal(c.fechaHora).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
        const puedeCalificar = c.estado !== "cancelada" && !esFutura(c) && !citasResenadas.has(String(c.id).toLowerCase());
        const calificar = puedeCalificar
            ? `<a href="perfil-medico.html?id=${encodeURIComponent(c.medicoId)}&cita=${encodeURIComponent(c.id)}#resena" class="d-block small text-decoration-none fw-semibold mt-1" style="color:#d97706;">⭐ Calificar</a>`
            : "";
        const cancelar = esActiva(c)
            ? `<a href="#" class="d-block small text-decoration-none text-danger mt-1" data-cancelar="${escaparHtml(c.id)}">Cancelar</a>`
            : "";
        return `
            <div class="list-group-item px-0 d-flex justify-content-between align-items-center py-3 gap-3">
                <div>
                    <h6 class="fw-bold mb-1">Dr. ${escaparHtml(c.doctor)}</h6>
                    <p class="text-muted small mb-0">${escaparHtml(c.especialidad ?? "Medicina general")} • ${c.modalidad === "video" ? "Videoconsulta" : "Presencial"}${c.motivo ? ` • ${escaparHtml(c.motivo)}` : ""}</p>
                </div>
                <div class="text-end flex-shrink-0">
                    <span class="text-muted small d-block">${fecha} • ${formatoHora(c.fechaHora)}</span>
                    <span class="badge border ${clase}">${escaparHtml(estado)}</span>
                    <a href="confirmacion.html?id=${encodeURIComponent(c.id)}" class="d-block small text-decoration-none mt-1">Ver comprobante</a>
                    ${calificar}
                    ${cancelar}
                </div>
            </div>`;
    }).join("");

    lnk.classList.toggle("d-none", citas.length <= CITAS_INICIALES);
    lnk.textContent = verTodas ? "Ver menos" : `Ver todas (${citas.length})`;
}

async function cancelarCita(id) {
    const cita = citas.find((c) => c.id === id);
    const detalle = cita ? ` con el Dr. ${cita.doctor} (${cuandoEs(cita.fechaHora)})` : "";
    if (!confirm(`¿Seguro que quieres cancelar tu cita${detalle}?`)) return;

    try {
        const resultado = await apiFetch(`/api/citas/${encodeURIComponent(id)}/cancelar`, { method: "POST" });
        mostrarAviso(resultado?.respuesta || "Cita cancelada");
        await cargarCitas();
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    }
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensaje");
    caja.textContent = texto;
    caja.className = `alert alert-${tipo}`;
}
