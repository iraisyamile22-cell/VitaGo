// Página de inicio: saludo, buscador de médicos (sp_buscarMedicos) y tarjetas de resultados
const COLORES_AVATAR = ["#DBEAFE", "#FDE68A", "#D1FAE5", "#FCE7F3", "#E9D5FF", "#FED7AA"];

document.addEventListener("DOMContentLoaded", () => {
    mostrarSaludo();
    cargarEspecialidades();

    // Enter en cualquier campo del buscador también busca
    document.querySelectorAll(".vg-search-row .vg-field-input").forEach((campo) => {
        campo.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); buscarMedicos(); }
        });
    });

    // Al entrar se muestran todos los médicos (búsqueda sin filtros)
    buscarMedicos({ desplazar: false });
});

// ---------- Saludo (auth.js define obtenerUsuario y saludoSegunHora) ----------
function mostrarSaludo() {
    const saludo = document.getElementById("saludoUsuario");
    if (!saludo || typeof obtenerUsuario !== "function") return;

    const usuario = obtenerUsuario();
    if (!usuario) return;

    document.getElementById("saludoTexto").textContent =
        `¡${saludoSegunHora()}, ${nombreParaMostrar(usuario)}!`;
    saludo.classList.remove("d-none");
}

// ---------- Sugerencias de especialidad (GET /api/especialidades) ----------
async function cargarEspecialidades() {
    const lista = document.getElementById("listaEspecialidades");
    if (!lista) return;
    try {
        const respuesta = await fetch("/api/especialidades");
        if (!respuesta.ok) return;
        const especialidades = await respuesta.json();
        lista.innerHTML = especialidades
            .map((e) => `<option value="${escaparHtml(e.nombre)}"></option>`)
            .join("");
    } catch {
        // Si falla, el campo sigue funcionando como texto libre
    }
}

// ---------- Búsqueda (GET /api/doctores/buscar?especialidad=&ciudad=) ----------
async function buscarMedicos(opciones = {}) {
    const desplazar = opciones.desplazar ?? true;
    const contenedor = document.getElementById("listaMedicos");
    const resumen = document.getElementById("resultadoBusqueda");

    // "Tula de Allende, Hgo." -> "Tula de Allende" (el estado no viene en la columna ciudad)
    const ciudad = document.getElementById("buscarCiudad").value.split(",")[0].trim();
    const especialidad = document.getElementById("buscarEspecialidad").value.trim();

    const parametros = new URLSearchParams();
    if (ciudad) parametros.set("ciudad", ciudad);
    if (especialidad) parametros.set("especialidad", especialidad);

    contenedor.innerHTML = '<p class="vg-subtle">Buscando especialistas...</p>';
    if (desplazar) document.getElementById("medicos").scrollIntoView({ behavior: "smooth" });

    try {
        const respuesta = await fetch(`/api/doctores/buscar?${parametros}`);
        if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
        const medicos = await respuesta.json();

        if (medicos.length === 0) {
            resumen.textContent = "Sin resultados con esos filtros.";
            contenedor.innerHTML = `
                <div class="col-12">
                    <p class="vg-subtle mb-0">No encontramos médicos${especialidad ? ` de <strong>${escaparHtml(especialidad)}</strong>` : ""}${ciudad ? ` en <strong>${escaparHtml(ciudad)}</strong>` : ""}. Prueba con otra ciudad o especialidad.</p>
                </div>`;
            return;
        }

        resumen.textContent = `${medicos.length} ${medicos.length === 1 ? "especialista encontrado" : "especialistas encontrados"} • Perfiles verificados.`;
        contenedor.innerHTML = medicos.map(tarjetaMedico).join("");
    } catch (error) {
        console.error(error);
        resumen.textContent = "No fue posible cargar los especialistas.";
        contenedor.innerHTML = '<p class="vg-subtle">No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose.</p>';
    }
}

function tarjetaMedico(m, i) {
    const nombre = `${m.nombre ?? ""} ${m.apellido ?? ""}`.trim();
    const iniciales = nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
    const color = COLORES_AVATAR[i % COLORES_AVATAR.length];
    const especialidad = m.especialidad ?? "Medicina general";
    const experiencia = m.aniosExperiencia > 0 ? ` • ${m.aniosExperiencia} años exp.` : "";
    const rating = m.rating != null ? Number(m.rating).toFixed(1) : "Nuevo";
    const lugar = [m.consultorio, m.ciudad].filter(Boolean).join(", ") || "Solo videoconsulta";
    const precio = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(m.precioConsulta ?? 0);
    const fecha = document.getElementById("buscarFecha").value;
    const id = encodeURIComponent(m.id);

    return `
    <div class="col-md-4">
        <div class="vg-doctor-card">
            <div class="vg-doctor-top">
                <span class="vg-avatar" style="background:${color};">${escaparHtml(iniciales)}</span>
                <div class="vg-doctor-meta">
                    <h3 class="vg-doctor-name">Dr. ${escaparHtml(nombre)}${m.verificado ? ' <span title="Verificado" style="color:#10b981;">✓</span>' : ""}</h3>
                    <p class="vg-doctor-spec">${escaparHtml(especialidad)}${experiencia}</p>
                    <div class="vg-rating">
                        <svg viewBox="0 0 24 24" fill="#f59e0b" stroke="none" width="14" height="14"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" /></svg>
                        <span class="vg-rating-num">${rating}</span>
                        <span class="vg-rating-count">(${m.totalResenas ?? 0} reseñas)</span>
                    </div>
                </div>
            </div>
            <div class="vg-doctor-details">
                <span><svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg> ${escaparHtml(lugar)}</span>
                <span>${precio}${m.consultaOnline ? " • 🎥 Online" : ""}</span>
            </div>
            <div class="vg-doctor-actions">
                <button type="button" class="vg-btn vg-btn-primary flex-fill" onclick="agendarCita('${id}', '${fecha}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
                    Agenda
                </button>
                <a href="perfil-medico.html?id=${id}" class="vg-btn vg-btn-outline flex-fill">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
                    Ver perfil
                </a>
            </div>
        </div>
    </div>`;
}

function agendarCita(medicoId, fecha = "") {
    const parametros = new URLSearchParams({ medico: medicoId });
    if (fecha) parametros.set("fecha", fecha);
    window.location.href = `agendar-cita.html?${parametros}`;
}

// Evita que un texto de la BD se interprete como HTML
function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
