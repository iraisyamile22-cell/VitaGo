// Perfil público del médico: GET /api/doctores/{id}/perfil (sp_perfilMedico). Requiere js/auth.js.
// URL: perfil-medico.html?id=<medicoId>
const RESENAS_INICIALES = 3;
let resenas = [];
let ordenResenas = "recientes";
let mostrarTodas = false;

document.addEventListener("DOMContentLoaded", async () => {
    const avisoResena = sessionStorage.getItem("vitago_aviso_resena");
    if (avisoResena) { sessionStorage.removeItem("vitago_aviso_resena"); mostrarAviso(avisoResena); }

    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
        mostrarMensaje("No se indicó el médico. Elige uno desde el inicio.", "warning");
        document.getElementById("contenidoPerfil").classList.add("d-none");
        return;
    }

    let m;
    try {
        m = await apiFetch(`/api/doctores/${encodeURIComponent(id)}/perfil`);
    } catch (error) {
        mostrarMensaje(error.status === 404 ? "Este médico no existe o todavía no está aprobado." : error.message, "danger");
        document.getElementById("contenidoPerfil").classList.add("d-none");
        return;
    }

    const nombre = `Dr. ${m.nombre ?? ""} ${m.apellido ?? ""}`.trim();
    document.title = `${nombre} | vitaGo`;
    texto("nombreMedico", nombre);
    document.getElementById("badgeVerificado").classList.toggle("d-none", !m.verificado);
    texto("especialidadMedico", m.especialidad ?? "Medicina general");
    document.getElementById("ratingMedico").innerHTML = m.rating != null
        ? `⭐ ${Number(m.rating).toFixed(1)} <span class="text-muted">(${m.totalResenas} reseñas)</span>`
        : '<span class="text-muted">Sin reseñas todavía</span>';
    texto("experienciaMedico", m.aniosExperiencia > 0 ? `${m.aniosExperiencia} años` : "—");
    texto("pacientesMedico", m.numPacientes >= 1000 ? `${(m.numPacientes / 1000).toFixed(1)}k+` : (m.numPacientes || "—"));
    texto("idiomasMedico", m.idiomas || "Español");
    texto("bioMedico", m.bio || "Este especialista aún no agrega una descripción.");
    texto("precioMedico", formatoMoneda(m.precioConsulta));
    texto("txtOnline", m.consultaOnline ? "💻 Consulta online disponible" : "🏥 Solo consulta presencial");

    pintarFoto(m, nombre);
    pintarEspecialidades(m);
    pintarConsultorios(m.consultorios ?? []);
    pintarHorarios(m.horarios ?? []);
    pintarAcciones(m);

    document.getElementById("btnAgendar").href = `agendar-cita.html?medico=${encodeURIComponent(m.id)}`;
    document.getElementById("btnAgendar").textContent = `Agendar cita con ${nombre}`;

    // Reseñas: ordenar y "ver todas"
    resenas = m.resenas ?? [];
    document.querySelectorAll("[data-orden]").forEach((b) => b.addEventListener("click", () => {
        ordenResenas = b.dataset.orden;
        document.querySelectorAll("[data-orden]").forEach((x) => x.classList.toggle("active", x === b));
        pintarResenas();
    }));
    document.getElementById("lnkTodasResenas").addEventListener("click", (e) => {
        e.preventDefault();
        mostrarTodas = !mostrarTodas;
        pintarResenas();
    });
    pintarResenas();
    prepararResena(m.id);
});

// ---------- Dejar reseña (POST /api/citas/{id}/resena) ----------
const TEXTO_ESTRELLAS = ["", "Mala", "Regular", "Buena", "Muy buena", "Excelente"];
let calificacion = 0;

async function prepararResena(medicoId) {
    const aviso = document.getElementById("resenaAviso");
    const usuario = obtenerUsuario();

    if (!usuario) {
        aviso.innerHTML = '¿Ya te atendió? <a href="#" id="lnkLoginResena" class="text-success fw-semibold">Inicia sesión</a> para dejar tu reseña.';
        aviso.classList.remove("d-none");
        document.getElementById("lnkLoginResena").addEventListener("click", (e) => { e.preventDefault(); irALogin(); });
        return;
    }
    if (usuario.rol !== "paciente") return;

    let citas, resenadas;
    try {
        [citas, resenadas] = await Promise.all([apiFetch("/api/citas"), apiFetch("/api/citas/resenadas")]);
    } catch {
        return; // si falla, simplemente no se muestra el formulario
    }

    const yaCalificadas = new Set(resenadas.map((x) => String(x).toLowerCase()));
    const conEsteMedico = citas.filter((c) => String(c.medicoId).toLowerCase() === String(medicoId).toLowerCase());
    const pendientes = conEsteMedico.filter((c) =>
        c.estado !== "cancelada" && fechaLocal(c.fechaHora) < new Date() && !yaCalificadas.has(String(c.id).toLowerCase()));

    if (pendientes.length === 0) {
        if (conEsteMedico.some((c) => c.estado !== "cancelada" && fechaLocal(c.fechaHora) >= new Date())) {
            aviso.textContent = "Podrás dejar tu reseña después de tu cita con este especialista.";
            aviso.classList.remove("d-none");
        }
        return;
    }

    // Qué cita se califica (si viene ?cita= desde "Mis citas", esa)
    const pedida = new URLSearchParams(location.search).get("cita")?.toLowerCase();
    const select = document.getElementById("resenaCita");
    select.replaceChildren(...pendientes.map((c) =>
        new Option(`Cita del ${formatoFecha(c.fechaHora)} • ${formatoHora(c.fechaHora)}`, c.id)));
    if (pedida && pendientes.some((c) => String(c.id).toLowerCase() === pedida))
        select.value = pendientes.find((c) => String(c.id).toLowerCase() === pedida).id;
    select.classList.toggle("d-none", pendientes.length === 1);
    document.getElementById("resenaCitaTexto").textContent = pendientes.length === 1
        ? `Sobre tu cita del ${formatoFecha(pendientes[0].fechaHora)}.`
        : "Tienes varias citas sin calificar con este especialista. Elige cuál:";

    document.querySelectorAll(".vg-estrella").forEach((b) => {
        b.addEventListener("click", () => marcarEstrellas(Number(b.dataset.valor)));
        b.addEventListener("mouseenter", () => pintarEstrellas(Number(b.dataset.valor)));
        b.addEventListener("mouseleave", () => pintarEstrellas(calificacion));
    });
    const comentario = document.getElementById("resenaComentario");
    comentario.addEventListener("input", () => {
        document.getElementById("resenaContador").textContent = comentario.value.length;
    });
    document.getElementById("formResena").addEventListener("submit", publicarResena);

    const caja = document.getElementById("resena");
    caja.classList.remove("d-none");
    if (location.hash === "#resena") caja.scrollIntoView({ behavior: "smooth", block: "center" });
}

function marcarEstrellas(valor) {
    calificacion = valor;
    pintarEstrellas(valor);
    document.getElementById("resenaEtiqueta").textContent = TEXTO_ESTRELLAS[valor];
}

function pintarEstrellas(valor) {
    document.querySelectorAll(".vg-estrella").forEach((b) =>
        b.classList.toggle("activa", Number(b.dataset.valor) <= valor));
}

async function publicarResena(e) {
    e.preventDefault();
    if (!calificacion) {
        mostrarAviso("Elige de 1 a 5 estrellas antes de publicar.", "warning");
        return;
    }
    const boton = document.getElementById("btnPublicarResena");
    boton.disabled = true;
    try {
        const idCita = document.getElementById("resenaCita").value;
        const r = await apiFetch(`/api/citas/${encodeURIComponent(idCita)}/resena`, {
            method: "POST",
            body: { calificacion, comentario: document.getElementById("resenaComentario").value.trim() || null }
        });
        sessionStorage.setItem("vitago_aviso_resena", r?.respuesta || "¡Gracias por tu reseña!");
        // Se recarga sin ?cita= para ver la reseña publicada y el nuevo promedio
        location.replace(`perfil-medico.html?id=${encodeURIComponent(new URLSearchParams(location.search).get("id"))}`);
    } catch (error) {
        mostrarAviso(error.message, "danger");
        boton.disabled = false;
    }
}

function texto(id, valor) {
    document.getElementById(id).textContent = valor;
}

function pintarFoto(m, nombre) {
    const caja = document.getElementById("fotoMedico");
    if (!m.fotoUrl) { caja.textContent = inicialesDe(`${m.nombre} ${m.apellido}`); return; }
    const img = document.createElement("img");
    img.src = m.fotoUrl;
    img.alt = nombre;
    img.style.cssText = "width:100%; height:100%; object-fit:cover;";
    img.onerror = () => { caja.textContent = inicialesDe(`${m.nombre} ${m.apellido}`); };
    caja.replaceChildren(img);
}

function pintarEspecialidades(m) {
    const lista = m.especialidades?.length ? m.especialidades : [m.especialidad ?? "Medicina general"];
    document.getElementById("listaEspecialidades").innerHTML = lista
        .map((e) => `<span class="badge bg-light text-secondary border px-3 py-2">${escaparHtml(e)}</span>`).join("");
}

function urlMapa(c) {
    if (c.latitud != null && c.longitud != null)
        return `https://www.google.com/maps/search/?api=1&query=${c.latitud},${c.longitud}`;
    const direccion = [c.nombre, c.direccion, c.ciudad, c.estado, c.cp].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

function pintarConsultorios(consultorios) {
    const caja = document.getElementById("listaConsultorios");
    if (consultorios.length === 0) {
        caja.innerHTML = '<p class="text-muted small mb-0">Atiende solo por videoconsulta.</p>';
        return;
    }
    caja.innerHTML = consultorios.map((c) => `
        <div class="p-3 bg-light rounded border d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <div class="fw-bold text-dark small">${escaparHtml(c.nombre ?? "Consultorio")}</div>
                <div class="text-muted x-small">${escaparHtml([c.direccion, c.ciudad, c.estado].filter(Boolean).join(" • "))}</div>
            </div>
            <a href="${urlMapa(c)}" target="_blank" rel="noopener" class="text-success text-decoration-none small fw-bold">Ver en mapa →</a>
        </div>`).join("");
}

function pintarHorarios(horarios) {
    const caja = document.getElementById("listaHorarios");
    if (horarios.length === 0) {
        caja.innerHTML = '<p class="text-muted small mb-0">Sin horarios publicados.</p>';
        return;
    }
    caja.innerHTML = [...horarios].sort((a, b) => a.diaSemana - b.diaSemana).map((h) => `
        <div class="d-flex justify-content-between text-secondary small py-1">
            <span>${escaparHtml(h.diaNombre)}</span> <span>${escaparHtml(h.horaInicio)}-${escaparHtml(h.horaFin)}</span>
        </div>`).join("");
}

function pintarAcciones(m) {
    const llamar = document.getElementById("accLlamar");
    const mensaje = document.getElementById("accMensaje");
    const telefono = (m.telefono ?? "").replace(/[^\d+]/g, "");

    if (telefono) {
        texto("txtTelefono", m.telefono);
        llamar.href = `tel:${telefono}`;
        mensaje.href = `sms:${telefono}`;
    } else {
        const sinTelefono = (e) => { e.preventDefault(); mostrarAviso("Este médico no tiene un teléfono registrado.", "warning"); };
        llamar.addEventListener("click", sinTelefono);
        mensaje.addEventListener("click", sinTelefono);
    }

    const mapa = document.getElementById("accMapa");
    const c = m.consultorios?.[0];
    if (c) mapa.href = urlMapa(c);
    else mapa.addEventListener("click", (e) => { e.preventDefault(); mostrarAviso("Este médico atiende solo en línea.", "info"); });
}

function pintarResenas() {
    const caja = document.getElementById("listaResenas");
    const lnk = document.getElementById("lnkTodasResenas");

    if (resenas.length === 0) {
        caja.innerHTML = '<p class="text-muted small mb-0">Todavía no hay reseñas de este especialista.</p>';
        lnk.classList.add("d-none");
        return;
    }

    const ordenadas = [...resenas].sort((a, b) => ordenResenas === "mejores"
        ? b.rating - a.rating || new Date(b.fecha) - new Date(a.fecha)
        : new Date(b.fecha) - new Date(a.fecha));
    const visibles = mostrarTodas ? ordenadas : ordenadas.slice(0, RESENAS_INICIALES);

    caja.innerHTML = visibles.map((r, i) => `
        <div class="${i < visibles.length - 1 ? "border-bottom pb-3 mb-3" : ""}">
            <div class="d-flex justify-content-between">
                <span class="fw-bold small text-dark">${escaparHtml(r.autor ?? "Paciente")} <span class="text-muted fw-normal x-small">${hace(r.fecha)}</span></span>
                <span class="text-warning" title="${r.rating} de 5">${"★".repeat(r.rating)}${"☆".repeat(Math.max(0, 5 - r.rating))}</span>
            </div>
            <p class="text-secondary small mt-2 mb-0">${escaparHtml(r.comentario ?? "")}</p>
        </div>`).join("");

    lnk.classList.toggle("d-none", resenas.length <= RESENAS_INICIALES);
    lnk.textContent = mostrarTodas ? "Ver menos ↑" : `Ver todas las reseñas (${resenas.length}) →`;
}

function hace(fecha) {
    const dias = Math.floor((Date.now() - new Date(fecha)) / 86400000);
    if (dias < 1) return "Hoy";
    if (dias === 1) return "Ayer";
    if (dias < 7) return `Hace ${dias} días`;
    if (dias < 30) return `Hace ${Math.floor(dias / 7)} semana(s)`;
    if (dias < 365) return `Hace ${Math.floor(dias / 30)} mes(es)`;
    return `Hace ${Math.floor(dias / 365)} año(s)`;
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensaje");
    caja.textContent = texto;
    caja.className = `alert alert-${tipo}`;
}
