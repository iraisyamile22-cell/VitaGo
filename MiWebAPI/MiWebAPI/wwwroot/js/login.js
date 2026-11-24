// Requiere js/auth.js (guardarSesion, obtenerUsuario)
const RECORDAR_KEY = "vitago_correo_recordado";
const formLogin = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const recordar = document.getElementById("recordar");
const btnLogin = document.getElementById("btnLogin");
const mensajeLogin = document.getElementById("mensajeLogin");
const textoBotonOriginal = btnLogin.innerHTML;

// A dónde regresar después de entrar (?volver=agendar-cita.html?medico=...). Solo rutas internas.
function destinoDespuesDeLogin() {
    const volver = new URLSearchParams(location.search).get("volver");
    return volver && /^[\w\-]+\.html/.test(volver) ? volver : "index.html";
}

// Si ya hay una sesión activa, no tiene caso volver a iniciar sesión
if (obtenerUsuario()) window.location.replace(destinoDespuesDeLogin());

// Mensaje informativo dentro de la tarjeta (reutiliza la alerta del login)
function avisoLogin(texto, tipo = "info") {
    mensajeLogin.textContent = texto;
    mensajeLogin.className = `alert alert-${tipo}`;
}

// Mensaje que manda otra página (p. ej. después de registrarse o eliminar la cuenta)
const avisoInicial = new URLSearchParams(location.search).get("aviso");
if (avisoInicial === "registro-medico") avisoLogin("¡Registro completado! Tu perfil de médico ya aparece en el catálogo de vitaGo. Inicia sesión para entrar.", "success");
if (avisoInicial === "cuenta-eliminada") avisoLogin("Tu cuenta fue eliminada. Gracias por usar vitaGo.", "secondary");

document.querySelectorAll("[data-social]").forEach((boton) => {
    boton.addEventListener("click", () =>
        avisoLogin(`El acceso con ${boton.dataset.social} todavía no está disponible. Por ahora entra con tu correo y contraseña.`, "info"));
});

// Ojito: alterna entre ver y ocultar la contraseña
const btnVerPassword = document.getElementById("btnVerPassword");
btnVerPassword.addEventListener("click", () => {
  const oculta = password.type === "password";
  password.type = oculta ? "text" : "password";
  btnVerPassword.querySelector("i").className = oculta ? "bi bi-eye-slash" : "bi bi-eye";
  const texto = oculta ? "Ocultar contraseña" : "Mostrar contraseña";
  btnVerPassword.title = texto;
  btnVerPassword.setAttribute("aria-label", texto);
  password.focus();
});

// "Recordar usuario": rellena el correo guardado
const correoGuardado = localStorage.getItem(RECORDAR_KEY);
if (correoGuardado) {
    correo.value = correoGuardado;
    recordar.checked = true;
}

formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensajeLogin.className = "alert alert-danger d-none";
    btnLogin.disabled = true;
    btnLogin.textContent = "Ingresando...";

    try {
        const respuesta = await fetch("/api/Auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo: correo.value.trim(), password: password.value })
        });

        // La API puede responder sin JSON (p. ej. error 500), por eso se lee con cuidado
        let resultado = null;
        try { resultado = await respuesta.json(); } catch { /* respuesta sin cuerpo JSON */ }

        // Éxito = 200 OK con un token (LoginRespuesta). En 401 la API manda { respuesta: "..." }
        if (!respuesta.ok || !resultado?.token) {
            const motivo = resultado?.respuesta
                || (respuesta.status === 400 ? "Revisa el correo y la contraseña." : null)
                || `No fue posible iniciar sesión (error ${respuesta.status}).`;
            throw new Error(motivo);
        }

        guardarSesion(resultado);

        if (recordar.checked) localStorage.setItem(RECORDAR_KEY, correo.value.trim());
        else localStorage.removeItem(RECORDAR_KEY);

        window.location.replace(destinoDespuesDeLogin());
    } catch (error) {
        mensajeLogin.textContent = error instanceof TypeError
            ? "No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose."
            : error.message;
        mensajeLogin.className = "alert alert-danger";
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = textoBotonOriginal;
    }
});
