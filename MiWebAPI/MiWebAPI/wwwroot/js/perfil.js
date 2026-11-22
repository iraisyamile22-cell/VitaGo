// Perfil del paciente. Requiere js/auth.js.
//   Ver:      GET    /api/Pacientes/perfil          (sp_perfilPaciente)
//   Editar:   PUT    /api/Pacientes/perfil          (sp_editarPaciente)
//   Password: POST   /api/Auth/cambiar-password     (sp_cambiarPassword)
//   Eliminar: DELETE /api/Auth/cuenta               (sp_eliminarUsuario)
const usuarioPerfil = requerirSesion(); // si no hay sesión, manda al login
let perfilOriginal = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!usuarioPerfil) return;

    // Lo que ya tenemos de la sesión
    pintarNombre(nombreParaMostrar(usuarioPerfil));
    document.getElementById("perfilCorreo").textContent = usuarioPerfil.correo;
    document.getElementById("inpCorreo").value = usuarioPerfil.correo;

    conectarSeguridad();
    conectarEliminar();

    // Los datos personales editables solo existen para pacientes
    if (usuarioPerfil.rol !== "paciente") {
        document.querySelectorAll("#formPerfil input, #formPerfil select, #formPerfil button, #btnCambiarFoto")
            .forEach((el) => { if (el.id !== "inpCorreo") el.disabled = true; });
        mostrarMensaje(usuarioPerfil.rol === "medico"
            ? "Tus datos de médico se administran desde tu perfil público; aquí puedes cambiar tu contraseña o eliminar tu cuenta."
            : "Aquí puedes cambiar tu contraseña.", "info");
        return;
    }

    conectarFormulario();
    await cargarPerfil();
});

// ---------- Datos personales ----------
async function cargarPerfil() {
    try {
        perfilOriginal = await apiFetch("/api/Pacientes/perfil");
        llenarFormulario(perfilOriginal);
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    }
}

function llenarFormulario(p) {
    pintarNombre(`${p.nombre} ${p.apellidos ?? ""}`.trim());
    document.getElementById("inpNombre").value = p.nombre ?? "";
    document.getElementById("inpApellidos").value = p.apellidos ?? "";
    document.getElementById("inpTelefono").value = p.telefono ?? "";
    document.getElementById("inpFechaNac").value = p.fechaNacimiento ? p.fechaNacimiento.substring(0, 10) : "";
    document.getElementById("inpGenero").value = (p.genero ?? "").toLowerCase();
    document.getElementById("inpFotoUrl").value = p.fotoUrl ?? "";
    pintarFoto(p.fotoUrl);
    document.getElementById("formPerfil").classList.remove("was-validated");
}

function conectarFormulario() {
    const form = document.getElementById("formPerfil");
    const hoy = new Date();
    document.getElementById("inpFechaNac").max =
        `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

    form.addEventListener("submit", guardarPerfil);
    document.getElementById("btnCancelar").addEventListener("click", () => {
        if (perfilOriginal) llenarFormulario(perfilOriginal);
        document.getElementById("cajaFoto").classList.add("d-none");
        mostrarAviso("Se descartaron los cambios", "secondary");
    });

    document.getElementById("btnCambiarFoto").addEventListener("click", () => {
        const caja = document.getElementById("cajaFoto");
        caja.classList.toggle("d-none");
        if (!caja.classList.contains("d-none")) document.getElementById("inpFotoUrl").focus();
    });
    document.getElementById("inpFotoUrl").addEventListener("input", (e) => pintarFoto(e.target.value.trim()));
    document.getElementById("btnQuitarFoto").addEventListener("click", () => {
        document.getElementById("inpFotoUrl").value = "";
        pintarFoto(null);
    });
}

async function guardarPerfil(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }

    const foto = document.getElementById("inpFotoUrl").value.trim();
    if (foto && !/^https?:\/\//i.test(foto)) {
        mostrarMensaje("El enlace de la foto debe empezar con http:// o https://", "warning");
        return;
    }

    const datos = {
        nombre: document.getElementById("inpNombre").value.trim(),
        apellidos: document.getElementById("inpApellidos").value.trim() || null,
        telefono: document.getElementById("inpTelefono").value.trim() || null,
        fechaNacimiento: document.getElementById("inpFechaNac").value || null,
        genero: document.getElementById("inpGenero").value || null,
        fotoUrl: foto || null
    };

    const boton = document.getElementById("btnGuardar");
    boton.disabled = true;
    boton.textContent = "Guardando...";
    try {
        const resultado = await apiFetch("/api/Pacientes/perfil", { method: "PUT", body: datos });
        ocultarMensaje();
        mostrarAviso(resultado?.respuesta || "Perfil actualizado");

        // El nombre también se muestra en el navbar: se actualiza en la sesión
        const sesion = obtenerUsuario();
        if (sesion) {
            sesion.nombre = datos.nombre;
            guardarSesion(sesion);
            if (typeof pintarSesionNavbar === "function") pintarSesionNavbar();
        }
        await cargarPerfil();
        document.getElementById("cajaFoto").classList.add("d-none");
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    } finally {
        boton.disabled = false;
        boton.textContent = "Guardar cambios";
    }
}

// ---------- Contraseña ----------
function conectarSeguridad() {
    const form = document.getElementById("formPassword");
    document.getElementById("btnMostrarPassword").addEventListener("click", () => {
        form.classList.toggle("d-none");
        if (!form.classList.contains("d-none")) document.getElementById("inpPassActual").focus();
    });
    document.getElementById("btnCancelarPassword").addEventListener("click", () => {
        form.reset();
        form.classList.add("d-none");
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const actual = document.getElementById("inpPassActual").value;
        const nueva = document.getElementById("inpPassNueva").value;
        const confirmar = document.getElementById("inpPassConfirmar").value;

        if (!actual || nueva.length < 8) { mostrarMensaje("Escribe tu contraseña actual y una nueva de al menos 8 caracteres.", "warning"); return; }
        if (nueva !== confirmar) { mostrarMensaje("Las contraseñas nuevas no coinciden.", "warning"); return; }

        const boton = document.getElementById("btnGuardarPassword");
        boton.disabled = true;
        try {
            const r = await apiFetch("/api/Auth/cambiar-password", {
                method: "POST",
                body: { passwordActual: actual, passwordNueva: nueva },
                sinRedirigir: true   // un 401 aquí significa "contraseña incorrecta", no sesión vencida
            });
            ocultarMensaje();
            mostrarAviso(r?.respuesta || "Contraseña actualizada");
            form.reset();
            form.classList.add("d-none");
        } catch (error) {
            mostrarMensaje(error.message, "danger");
        } finally {
            boton.disabled = false;
        }
    });
}

// ---------- Eliminar cuenta ----------
function conectarEliminar() {
    const form = document.getElementById("formEliminar");
    document.getElementById("btnEliminarCuenta").addEventListener("click", () => {
        form.classList.remove("d-none");
        document.getElementById("inpPassEliminar").focus();
    });
    document.getElementById("btnCancelarEliminar").addEventListener("click", () => {
        form.reset();
        form.classList.add("d-none");
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = document.getElementById("inpPassEliminar").value;
        if (!password) { mostrarMensaje("Escribe tu contraseña para confirmar.", "warning"); return; }
        if (!confirm("Última confirmación: ¿eliminar tu cuenta de vitaGo? Esta acción no se puede deshacer.")) return;

        const boton = document.getElementById("btnConfirmarEliminar");
        boton.disabled = true;
        try {
            await apiFetch("/api/Auth/cuenta", { method: "DELETE", body: { password }, sinRedirigir: true });
            sessionStorage.removeItem(SESSION_KEY);
            window.location.replace("login.html?aviso=cuenta-eliminada");
        } catch (error) {
            mostrarMensaje(error.message, "danger");
            boton.disabled = false;
        }
    });
}

// ---------- Auxiliares ----------
function pintarNombre(nombreCompleto) {
    document.getElementById("perfilNombre").textContent = nombreCompleto;
    document.getElementById("perfilIniciales").textContent = inicialesDe(nombreCompleto);
}

function pintarFoto(url) {
    const avatar = document.getElementById("perfilAvatar");
    avatar.querySelector("img")?.remove();
    const iniciales = document.getElementById("perfilIniciales");
    iniciales.classList.remove("d-none");
    if (!url || !/^https?:\/\//i.test(url)) return;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto de perfil";
    img.style.cssText = "width:100%; height:100%; object-fit:cover;";
    img.onload = () => iniciales.classList.add("d-none");
    img.onerror = () => { img.remove(); iniciales.classList.remove("d-none"); };
    avatar.appendChild(img);
}

function mostrarMensaje(texto, tipo) {
    const aviso = document.getElementById("perfilMensaje");
    aviso.textContent = texto;
    aviso.className = `alert alert-${tipo}`;
    aviso.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ocultarMensaje() {
    document.getElementById("perfilMensaje").className = "alert d-none";
}
