// Manejo de la sesión del usuario en el navegador (se guarda en sessionStorage)
const SESSION_KEY = "vitago_sesion";

// Guarda lo que devuelve POST /api/Auth/login: token, expiraEn, usuarioId, perfilId, rol, nombre, correo
function guardarSesion(datosLogin) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(datosLogin));
}

function obtenerUsuario() {
    const valor = sessionStorage.getItem(SESSION_KEY);
    if (!valor) return null;
    try {
        const usuario = JSON.parse(valor);
        // Si el token ya expiró, la sesión deja de ser válida
        if (usuario.expiraEn && new Date(usuario.expiraEn) <= new Date()) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return usuario;
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
}

// Token JWT para mandar en el header Authorization: Bearer <token>
function obtenerToken() {
    return obtenerUsuario()?.token ?? null;
}

// Nombre para mostrar; si el usuario no tiene nombre se usa la parte del correo antes de la @
function nombreParaMostrar(usuario) {
    if (!usuario) return "";
    if (usuario.nombre && usuario.nombre.trim()) return usuario.nombre.trim();
    return (usuario.correo ?? "").split("@")[0];
}

// "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora local
function saludoSegunHora(fecha = new Date()) {
    const hora = fecha.getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
}

function protegerPagina() {
    if (!obtenerUsuario()) window.location.replace("login.html");
}

function mostrarUsuario(elementId) {
    const usuario = obtenerUsuario();
    const elemento = document.getElementById(elementId);
    if (usuario && elemento) elemento.textContent = nombreParaMostrar(usuario);
}

function cerrarSesion(destino = "login.html") {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace(destino);
}

// ---------- Helpers compartidos para llamar a la API ----------

// Manda a login y, al entrar, regresa a la página actual
function irALogin() {
    const volver = location.pathname.replace(/^\//, "") + location.search;
    window.location.href = `login.html?volver=${encodeURIComponent(volver)}`;
}

// Exige sesión (y opcionalmente un rol). Devuelve el usuario o null si redirigió.
function requerirSesion(roles) {
    const usuario = obtenerUsuario();
    if (!usuario) { irALogin(); return null; }
    if (roles && !(Array.isArray(roles) ? roles : [roles]).includes(usuario.rol)) {
        window.location.replace("index.html");
        return null;
    }
    return usuario;
}

// fetch con el token JWT y JSON. Lanza Error con el mensaje de la API si falla.
async function apiFetch(url, opciones = {}) {
    const headers = { ...(opciones.headers ?? {}) };
    const token = obtenerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opciones.body !== undefined && typeof opciones.body !== "string") {
        headers["Content-Type"] = "application/json";
        opciones = { ...opciones, body: JSON.stringify(opciones.body) };
    }

    let respuesta;
    try {
        respuesta = await fetch(url, { ...opciones, headers });
    } catch {
        throw new Error("No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose.");
    }

    let datos = null;
    try { datos = await respuesta.json(); } catch { /* sin cuerpo JSON */ }

    if (respuesta.status === 401 && token && !opciones.sinRedirigir) {
        // Token vencido o inválido: se cierra la sesión y se pide entrar otra vez
        sessionStorage.removeItem(SESSION_KEY);
        irALogin();
        throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
    }

    if (!respuesta.ok) {
        const mensaje = datos?.respuesta
            || (datos?.errors ? Object.values(datos.errors).flat().join(" ") : null)
            || (respuesta.status === 403 ? "No tienes permiso para esta acción." : null)
            || `Ocurrió un error (código ${respuesta.status}).`;
        const error = new Error(mensaje);
        error.status = respuesta.status;
        throw error;
    }
    return datos;
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

function formatoMoneda(valor, moneda = "MXN") {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format(valor ?? 0);
}

function inicialesDe(nombre) {
    return String(nombre ?? "").split(" ").filter(Boolean).slice(0, 2)
        .map(p => p[0].toUpperCase()).join("") || "👤";
}

// "2026-11-17T09:30:00" -> Date local (sin convertir zona horaria)
function fechaLocal(valor) {
    const [f, h = "00:00"] = String(valor).split("T");
    const [a, m, d] = f.split("-").map(Number);
    const [hh, mm] = h.split(":").map(Number);
    return new Date(a, m - 1, d, hh, mm);
}

function formatoFecha(valor) {
    return fechaLocal(valor).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatoHora(valor) {
    return fechaLocal(valor).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Aviso flotante sencillo (no bloquea como alert)
function mostrarAviso(texto, tipo = "success") {
    let caja = document.getElementById("vg-aviso");
    if (!caja) {
        caja = document.createElement("div");
        caja.id = "vg-aviso";
        caja.setAttribute("role", "status");
        caja.style.cssText = "position:fixed; right:20px; bottom:20px; z-index:10000; max-width:360px;";
        document.body.appendChild(caja);
    }
    caja.innerHTML = "";
    const alerta = document.createElement("div");
    alerta.className = `alert alert-${tipo} shadow mb-0`;
    alerta.textContent = texto;
    caja.appendChild(alerta);
    clearTimeout(mostrarAviso.t);
    mostrarAviso.t = setTimeout(() => caja.innerHTML = "", 4500);
}
