// Requiere js/auth.js (guardarSesion, obtenerUsuario)
const RECORDAR_KEY = "vitago_correo_recordado";
const formLogin = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const recordar = document.getElementById("recordar");
const btnLogin = document.getElementById("btnLogin");
const mensajeLogin = document.getElementById("mensajeLogin");
const textoBotonOriginal = btnLogin.innerHTML;

// Si ya hay una sesión activa, no tiene caso volver a iniciar sesión
if (obtenerUsuario()) window.location.replace("index.html");

// "Recordar usuario": rellena el correo guardado
const correoGuardado = localStorage.getItem(RECORDAR_KEY);
if (correoGuardado) {
    correo.value = correoGuardado;
    recordar.checked = true;
}

formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensajeLogin.classList.add("d-none");
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

        window.location.replace("index.html");
    } catch (error) {
        mensajeLogin.textContent = error instanceof TypeError
            ? "No se pudo conectar con la API. Verifica que el proyecto .NET esté ejecutándose."
            : error.message;
        mensajeLogin.classList.remove("d-none");
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = textoBotonOriginal;
    }
});
