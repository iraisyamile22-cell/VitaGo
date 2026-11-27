// verificar.html?token=...  -> lo abre el enlace del correo de verificación.
// POST /api/Auth/verificar (sp_verificarCorreo). Si el enlace falla, permite pedir uno nuevo.
// Requiere js/auth.js.
const token = new URLSearchParams(location.search).get("token");

function mostrarEstado(id) {
    ["estadoCargando", "estadoOk", "estadoError"].forEach((e) =>
        document.getElementById(e).classList.toggle("d-none", e !== id));
}

function mostrarError(titulo, texto) {
    document.getElementById("tituloError").textContent = titulo;
    document.getElementById("textoError").textContent = texto;
    mostrarEstado("estadoError");
}

async function verificar() {
    if (!token) {
        mostrarError("Falta el enlace", "Abre esta página desde el botón \"Verificar mi cuenta\" del correo que te enviamos.");
        return;
    }
    try {
        await apiFetch("/api/Auth/verificar", { method: "POST", body: { token } });
        mostrarEstado("estadoOk");
        // Quita el token de la barra de direcciones (ya se usó)
        history.replaceState(null, "", "verificar.html");
    } catch (error) {
        if (/venci/i.test(error.message)) mostrarError("El enlace venció", "Los enlaces duran 24 horas. Escribe tu correo y te mandamos uno nuevo.");
        else if (error.status === 400) mostrarError("El enlace no es válido", "Puede que ya lo hayas usado o que esté incompleto. Si ya verificaste tu cuenta, solo inicia sesión.");
        else mostrarError("No pudimos verificar tu correo", error.message);
    }
}

document.getElementById("formReenviar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = document.getElementById("correo").value.trim();
    const aviso = document.getElementById("mensajeReenvio");
    const boton = document.getElementById("btnReenviar");
    if (!correo) return;

    boton.disabled = true;
    try {
        const r = await apiFetch("/api/Auth/reenviar-verificacion", { method: "POST", body: { correo } });
        aviso.textContent = r?.respuesta || "Te enviamos un correo nuevo.";
        aviso.className = "alert alert-success";
    } catch (error) {
        aviso.textContent = error.message;
        aviso.className = "alert alert-warning";
    } finally {
        setTimeout(() => { boton.disabled = false; }, 60000);
    }
});

verificar();
