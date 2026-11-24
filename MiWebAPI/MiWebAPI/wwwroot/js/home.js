// Página de inicio: saludo, buscador de médicos (sp_buscarMedicos) y tarjetas de resultados
const COLORES_AVATAR = ["#DBEAFE", "#FDE68A", "#D1FAE5", "#FCE7F3", "#E9D5FF", "#FED7AA"];
const MEDICOS_INICIALES = 6;   // cuántas tarjetas se ven antes de "Ver más"
let medicosEncontrados = [];
let verTodosMedicos = false;

document.addEventListener("DOMContentLoaded", () => {
    mostrarSaludo();
    cargarEspecialidades();

    // Enter en cualquier campo del buscador también busca
    document.querySelectorAll(".vg-search-row .vg-field-input").forEach((campo) => {
        campo.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); buscarMedicos(); }
        });
    });

    // Tarjetas de especialidad: al dar clic se busca esa especialidad
    document.querySelectorAll("[data-especialidad]").forEach((tarjeta) => {
        const buscar = () => abrirModalEspecialidad(tarjeta.dataset.especialidad);
        tarjeta.style.cursor = "pointer";
        tarjeta.addEventListener("click", buscar);
        tarjeta.addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
    });

    // "Ver todas" las especialidades
    document.getElementById("lnkVerEspecialidades")?.addEventListener("click", (e) => {
        e.preventDefault();
        const caja = document.getElementById("todasEspecialidades");
        const abierta = !caja.classList.contains("d-none");
        caja.classList.toggle("d-none", abierta);
        e.currentTarget.textContent = abierta ? "Ver todas" : "Ocultar";
    });

    // "Ver todos los médicos": quita los filtros
    document.getElementById("lnkVerTodosMedicos")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("buscarCiudad").value = "";
        document.getElementById("buscarEspecialidad").value = "";
        buscarMedicos();
    });

    llenarFechas();

    // Los desplegables buscan en cuanto cambian
    document.getElementById("buscarEspecialidad").addEventListener("change", () => buscarMedicos({ desplazar: false }));

    // "Ver más" / "Ver menos" en la lista de médicos
    document.getElementById("btnVerMasMedicos").addEventListener("click", () => {
        verTodosMedicos = !verTodosMedicos;
        pintarMedicos();
        if (!verTodosMedicos) document.getElementById("medicos").scrollIntoView({ behavior: "smooth" });
    });

    conectarModalEspecialidad();

    // Al entrar se muestran todos los médicos (búsqueda sin filtros)
    buscarMedicos({ desplazar: false });

    // index.html?especialidad=Cardiología abre directo la ventana
    const especialidadUrl = new URLSearchParams(location.search).get("especialidad");
    if (especialidadUrl) abrirModalEspecialidad(especialidadUrl);
});

function buscarPorEspecialidad(especialidad) {
    seleccionarEspecialidad(especialidad);
    buscarMedicos();
}

// Elige una especialidad en el desplegable (si no está en la lista, la agrega)
function seleccionarEspecialidad(nombre) {
    const select = document.getElementById("buscarEspecialidad");
    if (nombre && ![...select.options].some((o) => o.value === nombre)) select.add(new Option(nombre, nombre));
    select.value = nombre ?? "";
}

// Desplegable de fechas: hoy y los próximos 30 días
function llenarFechas() {
    const select = document.getElementById("buscarFecha");
    const hoy = new Date();
    for (let i = 0; i <= 30; i++) {
        const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
        const valor = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
        let texto = dia.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
        if (i === 0) texto = `Hoy, ${texto}`;
        if (i === 1) texto = `Mañana, ${texto}`;
        select.add(new Option(texto.charAt(0).toUpperCase() + texto.slice(1), valor));
    }
}

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

// ---------- Desplegable de especialidades (GET /api/especialidades) ----------
async function cargarEspecialidades() {
    const select = document.getElementById("buscarEspecialidad");
    if (!select) return;
    try {
        const respuesta = await fetch("/api/especialidades");
        if (!respuesta.ok) return;
        const especialidades = await respuesta.json();
        const elegida = select.value;
        select.replaceChildren(new Option("Todas las especialidades", ""),
            ...especialidades.map((e) => new Option(e.nombre, e.nombre)));
        if (elegida) seleccionarEspecialidad(elegida);

        // Chips con todas las especialidades (para "Ver todas")
        const caja = document.getElementById("todasEspecialidades");
        if (caja) {
            caja.replaceChildren(...especialidades.map((e) => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "btn btn-sm btn-outline-success rounded-pill px-3";
                chip.textContent = e.nombre;
                chip.title = e.descripcion ?? "";
                chip.addEventListener("click", () => abrirModalEspecialidad(e.nombre));
                return chip;
            }));
        }
    } catch {
        // Si falla, el desplegable se queda solo con "Todas las especialidades"
    }
}

// ---------- Búsqueda (GET /api/doctores/buscar?especialidad=&ciudad=) ----------
async function buscarMedicos(opciones = {}) {
    const desplazar = opciones.desplazar ?? true;
    const contenedor = document.getElementById("listaMedicos");
    const resumen = document.getElementById("resultadoBusqueda");

    // "Tula de Allende, Hgo." -> "Tula de Allende" (el estado no viene en la columna ciudad)
    const ciudad = document.getElementById("buscarCiudad").value.split(",")[0].trim();
    const especialidad = document.getElementById("buscarEspecialidad").value;

    const parametros = new URLSearchParams();
    if (ciudad) parametros.set("ciudad", ciudad);
    if (especialidad) parametros.set("especialidad", especialidad);

    contenedor.innerHTML = '<p class="vg-subtle vg-grid-completa">Buscando especialistas...</p>';
    document.getElementById("btnVerMasMedicos").classList.add("d-none");
    if (desplazar) document.getElementById("medicos").scrollIntoView({ behavior: "smooth" });

    try {
        const respuesta = await fetch(`/api/doctores/buscar?${parametros}`);
        if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
        const medicos = await respuesta.json();

        if (medicos.length === 0) {
            resumen.textContent = "Sin resultados con esos filtros.";
            contenedor.innerHTML = `
                <div class="vg-grid-completa">
                    <p class="vg-subtle mb-0">No encontramos médicos${especialidad ? ` de <strong>${escaparHtml(especialidad)}</strong>` : ""}${ciudad ? ` en <strong>${escaparHtml(ciudad)}</strong>` : ""}. Prueba con otra ciudad o especialidad.</p>
                </div>`;
            return;
        }

        resumen.textContent = `${medicos.length} ${medicos.length === 1 ? "especialista encontrado" : "especialistas encontrados"}.`;
        medicosEncontrados = medicos;
        verTodosMedicos = false;
        pintarMedicos();
    } catch (error) {
        console.error(error);
        resumen.textContent = "No fue posible cargar los especialistas.";
        contenedor.innerHTML = '<p class="vg-subtle vg-grid-completa">No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose.</p>';
    }
}

// Pinta las tarjetas (solo las primeras MEDICOS_INICIALES si no se pidió "Ver más")
function pintarMedicos() {
    const visibles = verTodosMedicos ? medicosEncontrados : medicosEncontrados.slice(0, MEDICOS_INICIALES);
    document.getElementById("listaMedicos").innerHTML = visibles.map(tarjetaMedico).join("");

    const boton = document.getElementById("btnVerMasMedicos");
    const sobran = medicosEncontrados.length - MEDICOS_INICIALES;
    boton.classList.toggle("d-none", sobran <= 0);
    boton.textContent = verTodosMedicos ? "Ver menos" : `Ver más (${sobran})`;
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
    const id = encodeURIComponent(m.id);

    return `
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
                <button type="button" class="vg-btn vg-btn-primary flex-fill" onclick="agendarCita('${id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
                    Agenda
                </button>
                <a href="perfil-medico.html?id=${id}" class="vg-btn vg-btn-outline flex-fill">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
                    Ver perfil
                </a>
            </div>
    </div>`;
}

function agendarCita(medicoId) {
    // La fecha se lee al momento del clic (pudo cambiar después de pintar las tarjetas)
    const fecha = document.getElementById("buscarFecha").value;
    const parametros = new URLSearchParams({ medico: medicoId });
    if (fecha) parametros.set("fecha", fecha);
    window.location.href = `agendar-cita.html?${parametros}`;
}

// ---------- Ventana: médicos de una especialidad ----------
let especialidadModal = "";
let elementoAntesDelModal = null;

function conectarModalEspecialidad() {
    const modal = document.getElementById("modalEspecialidad");
    if (!modal) return;
    modal.querySelectorAll("[data-cerrar-modal]").forEach((el) => el.addEventListener("click", cerrarModalEspecialidad));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) cerrarModalEspecialidad();
    });
    // "Ver en el buscador": aplica el filtro a la lista principal
    document.getElementById("modalEspVerBuscador").addEventListener("click", () => {
        cerrarModalEspecialidad();
        buscarPorEspecialidad(especialidadModal);
    });
}

async function abrirModalEspecialidad(especialidad) {
    const modal = document.getElementById("modalEspecialidad");
    const lista = document.getElementById("modalEspLista");
    const resumen = document.getElementById("modalEspResumen");
    especialidadModal = especialidad;
    elementoAntesDelModal = document.activeElement;

    document.getElementById("modalEspTitulo").textContent = especialidad;
    resumen.textContent = "Buscando especialistas...";
    lista.innerHTML = "";
    modal.hidden = false;
    document.body.classList.add("vg-modal-abierto");
    modal.querySelector(".vg-modal-cerrar").focus();

    try {
        const respuesta = await fetch(`/api/doctores/buscar?especialidad=${encodeURIComponent(especialidad)}`);
        if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
        const medicos = await respuesta.json();
        if (especialidadModal !== especialidad) return; // se abrió otra mientras cargaba

        if (medicos.length === 0) {
            resumen.textContent = "Por ahora no hay médicos registrados con esta especialidad.";
            lista.innerHTML = `
                <div class="vg-grid-completa text-center py-4">
                    <p class="vg-subtle mb-3">¿Eres especialista en ${escaparHtml(especialidad)}? Regístrate y aparece aquí.</p>
                    <a href="registro-medico.html?tipo=medico" class="vg-btn vg-btn-primary d-inline-flex">Registrarme como médico</a>
                </div>`;
            return;
        }

        resumen.textContent = `${medicos.length} ${medicos.length === 1 ? "especialista disponible" : "especialistas disponibles"}`;
        lista.innerHTML = medicos.map(tarjetaMedico).join("");
    } catch (error) {
        console.error(error);
        resumen.textContent = "No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose.";
    }
}

function cerrarModalEspecialidad() {
    document.getElementById("modalEspecialidad").hidden = true;
    document.body.classList.remove("vg-modal-abierto");
    elementoAntesDelModal?.focus?.();
}
