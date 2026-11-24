// Perfil del paciente. Requiere js/auth.js.
//   Ver:      GET    /api/Pacientes/perfil          (sp_perfilPaciente)
//   Editar:   PUT    /api/Pacientes/perfil          (sp_editarPaciente)
//   Password: POST   /api/Auth/cambiar-password     (sp_cambiarPassword)
//   Eliminar: DELETE /api/Auth/cuenta               (sp_eliminarUsuario)
const usuarioPerfil = requerirSesion(); // si no hay sesión, manda al login
const FOTO_LADO = 300;          // la foto se guarda recortada a 300x300
const FOTO_MAX_MB = 10;         // tamaño máximo del archivo original
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
        document.querySelectorAll("#btnEditar, #btnCambiarFoto").forEach((el) => { el.disabled = true; });
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
    pintarFoto(p.fotoUrl);
    document.getElementById("formPerfil").classList.remove("was-validated");
}

// Modo lectura (campos bloqueados, botón "Editar") o modo edición ("Guardar cambios" / "Cancelar")
function modoEdicion(editando) {
    document.getElementById("camposPerfil").disabled = !editando;
    document.getElementById("btnEditar").classList.toggle("d-none", editando);
    document.getElementById("btnGuardar").classList.toggle("d-none", !editando);
    document.getElementById("btnCancelar").classList.toggle("d-none", !editando);
    const badge = document.getElementById("badgeModo");
    badge.textContent = editando ? "Editando" : "Solo lectura";
    badge.className = editando ? "badge bg-success-subtle text-success border border-success-subtle" : "badge bg-light text-secondary border";
    if (editando) document.getElementById("inpNombre").focus();
}

function conectarFormulario() {
    const form = document.getElementById("formPerfil");
    const hoy = new Date();
    document.getElementById("inpFechaNac").max =
        `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

    form.addEventListener("submit", guardarPerfil);
    document.getElementById("btnEditar").addEventListener("click", () => modoEdicion(true));
    document.getElementById("btnCancelar").addEventListener("click", () => {
        if (perfilOriginal) llenarFormulario(perfilOriginal);
        modoEdicion(false);
        ocultarMensaje();
    });

    // Foto: se elige del dispositivo y se guarda al momento
    const inpFoto = document.getElementById("inpFoto");
    document.getElementById("btnCambiarFoto").addEventListener("click", () => inpFoto.click());
    inpFoto.addEventListener("change", async () => {
        const archivo = inpFoto.files[0];
        inpFoto.value = "";   // permite volver a elegir el mismo archivo
        if (!archivo) return;
        if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return mostrarMensaje("Elige una imagen JPG, PNG o WEBP.", "warning");
        if (archivo.size > FOTO_MAX_MB * 1024 * 1024) return mostrarMensaje(`La imagen pesa más de ${FOTO_MAX_MB} MB. Elige una más ligera.`, "warning");
        try {
            await guardarFoto(await recortarFoto(archivo));
        } catch (error) {
            mostrarMensaje(error.message || "No se pudo leer la imagen.", "danger");
        }
    });
    document.getElementById("btnQuitarFoto").addEventListener("click", () => {
        if (confirm("¿Quitar tu foto de perfil?")) guardarFoto(null);
    });
}

// Recorta la imagen al centro (cuadrada) y la reduce a FOTO_LADO px -> data:image/jpeg;base64,...
function recortarFoto(archivo) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(archivo);
        const img = new Image();
        img.onload = () => {
            const lado = Math.min(img.naturalWidth, img.naturalHeight);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = FOTO_LADO;
            canvas.getContext("2d").drawImage(img,
                (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado,
                0, 0, FOTO_LADO, FOTO_LADO);
            URL.revokeObjectURL(url);
            resolver(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error("No se pudo leer la imagen.")); };
        img.src = url;
    });
}

// Guarda solo la foto, con los demás datos tal como están en la base (PUT /api/Pacientes/perfil)
async function guardarFoto(foto) {
    if (!perfilOriginal) return;
    const boton = document.getElementById("btnCambiarFoto");
    boton.disabled = true;
    boton.textContent = "Guardando foto...";
    try {
        const p = perfilOriginal;
        await apiFetch("/api/Pacientes/perfil", {
            method: "PUT",
            body: {
                nombre: p.nombre,
                apellidos: p.apellidos,
                telefono: p.telefono,
                fechaNacimiento: p.fechaNacimiento ? p.fechaNacimiento.substring(0, 10) : null,
                genero: p.genero,
                fotoUrl: foto
            }
        });
        perfilOriginal = { ...perfilOriginal, fotoUrl: foto };
        pintarFoto(foto);
        ocultarMensaje();
        mostrarAviso(foto ? "Foto actualizada" : "Foto eliminada");
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    } finally {
        boton.disabled = false;
        boton.textContent = "📷 Cambiar foto";
    }
}

async function guardarPerfil(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    if (!form.checkValidity()) { form.classList.add("was-validated"); return; }

    const datos = {
        nombre: document.getElementById("inpNombre").value.trim(),
        apellidos: document.getElementById("inpApellidos").value.trim() || null,
        telefono: document.getElementById("inpTelefono").value.trim() || null,
        fechaNacimiento: document.getElementById("inpFechaNac").value || null,
        genero: document.getElementById("inpGenero").value || null,
        fotoUrl: perfilOriginal?.fotoUrl ?? null   // la foto se cambia con su propio botón
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
        modoEdicion(false);
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
    const valida = !!url && (/^https?:\/\//i.test(url) || /^data:image\/(jpeg|png|webp);base64,/i.test(url));
    document.getElementById("btnQuitarFoto").classList.toggle("d-none", !valida);
    if (!valida) return;

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
