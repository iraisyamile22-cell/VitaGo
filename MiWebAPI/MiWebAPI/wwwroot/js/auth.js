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
