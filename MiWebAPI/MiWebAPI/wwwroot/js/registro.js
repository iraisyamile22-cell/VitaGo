// Registro de cuenta (diseño de Ayelen: primero se elige Paciente o Médico).
// Al terminar, la cuenta queda SIN VERIFICAR y se muestra "Revisa tu correo" (pantallaCorreo).
// Requiere js/auth.js (apiFetch, guardarSesion, escaparHtml).
//   Paciente: POST /api/Pacientes (sp_registrarPaciente) -> POST /api/Auth/login
//             -> PUT /api/Pacientes/perfil para guardar el teléfono (sp_editarPaciente)
//   Médico:   POST /api/doctores (sp_crearDoctor). Se aprueba solo y aparece de inmediato en el catálogo.
// También acepta registro-medico.html?tipo=paciente  o  ?tipo=medico  para abrir directo el formulario.

const pantallaSeleccion = document.getElementById("pantallaSeleccion");
const pantallaFormulario = document.getElementById("pantallaFormulario");

const formulario = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensajeRegistro");
const boton = document.getElementById("btnRegistrar");

const tipoUsuario = document.getElementById("tipoUsuario");
const datosMedico = document.getElementById("datosMedico");

const tituloFormulario = document.getElementById("tituloFormulario");
const descripcionFormulario = document.getElementById("descripcionFormulario");

// Campos que solo se piden al médico
const camposMedico = ["especialidad", "cedula", "precio", "consultorio", "direccion", "ciudad", "horaInicio", "horaFin"]
    .map((id) => document.getElementById(id));

// Si ya hay sesión no tiene caso registrarse
if (obtenerUsuario()) window.location.replace("index.html");

document.addEventListener("DOMContentLoaded", () => {
    cargarEspecialidades();

    const tipo = new URLSearchParams(location.search).get("tipo");
    if (tipo === "medico") seleccionarCuenta("medico");
    if (tipo === "paciente" || tipo === "usuario") seleccionarCuenta("usuario");
});

// Las especialidades salen de la base (GET /api/especialidades); si falla se quedan las del HTML
async function cargarEspecialidades() {
    try {
        const lista = await apiFetch("/api/especialidades");
        if (!lista?.length) return;
        document.getElementById("especialidad").innerHTML =
            '<option value="" selected disabled>Selecciona especialidad</option>' +
            lista.map((e) => `<option value="${escaparHtml(e.nombre)}">${escaparHtml(e.nombre)}</option>`).join("");
    } catch { /* se queda la lista fija */ }
}


// =====================================
// SELECCIONAR TIPO DE CUENTA
// =====================================

function seleccionarCuenta(tipo) {
    tipoUsuario.value = tipo;
    ocultarMensaje();

    pantallaSeleccion.classList.add("oculto");
    pantallaFormulario.classList.remove("oculto");

    const esMedico = tipo === "medico";
    tituloFormulario.textContent = esMedico ? "Registro de médico" : "Registro de paciente";
    descripcionFormulario.textContent = esMedico
        ? "Completa tus datos personales, profesionales y de tu consultorio."
        : "Completa tus datos personales para crear tu cuenta en vitaGo.";

    datosMedico.classList.toggle("oculto", !esMedico);
    camposMedico.forEach((campo) => { campo.required = esMedico; });

    window.scrollTo({ top: 0, behavior: "smooth" });
}


// =====================================
// REGRESAR A LA SELECCIÓN
// =====================================

function regresarSeleccion() {
    formulario.reset();
    formulario.classList.remove("was-validated");
    ocultarMensaje();

    datosMedico.classList.add("oculto");
    pantallaFormulario.classList.add("oculto");
    pantallaSeleccion.classList.remove("oculto");
    tipoUsuario.value = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}


// =====================================
// ENVÍO DEL FORMULARIO
// =====================================

const valor = (id) => document.getElementById(id).value.trim();
const opcional = (id) => valor(id) || null;

formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarMensaje();

    const tipo = tipoUsuario.value;
    const contrasena = document.getElementById("contrasena").value;

    if (!formulario.checkValidity()) {
        formulario.classList.add("was-validated");
        return mostrarMensaje("Revisa los campos marcados en rojo. La contraseña debe tener al menos 8 caracteres.", "warning");
    }
    if (contrasena !== document.getElementById("confirmarContrasena").value) {
        document.getElementById("confirmarContrasena").focus();
        return mostrarMensaje("Las contraseñas no coinciden.", "warning");
    }

    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = "Registrando...";

    try {
        if (tipo === "medico") await registrarMedico(contrasena);
        else await registrarPaciente(contrasena);
    } catch (error) {
        mostrarMensaje(error.message, "danger");
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
});

async function registrarPaciente(contrasena) {
    const correo = valor("correo");

    // La API guarda también el teléfono y manda el correo de verificación
    const r = await apiFetch("/api/Pacientes", {
        method: "POST",
        body: { correo, password: contrasena, nombre: valor("nombre"), apellidos: valor("apellidos"), telefono: opcional("telefono") }
    });

    mostrarPantallaCorreo(correo, r?.correoEnviado);
}

async function registrarMedico(contrasena) {
    const diaInicio = Number(valor("diaInicio"));
    const diaFin = Number(valor("diaFin"));
    if (diaFin < diaInicio) throw new Error("El día final del horario no puede ser antes del día inicial.");
    if (valor("horaFin") <= valor("horaInicio")) throw new Error("La hora de salida debe ser después de la hora de entrada.");

    const r = await apiFetch("/api/doctores", {
        method: "POST",
        body: {
            correo: valor("correo"),
            password: contrasena,
            nombre: valor("nombre"),
            apellidos: valor("apellidos"),
            telefono: opcional("telefono"),
            especialidad: valor("especialidad"),
            cedula: valor("cedula"),
            precioConsulta: Number(valor("precio") || 0),
            consultaOnline: document.getElementById("consultaOnline").checked,
            consultorio: {
                nombre: valor("consultorio"),
                direccion: valor("direccion"),
                ciudad: valor("ciudad"),
                diaInicio,
                diaFin,
                horaInicio: valor("horaInicio").substring(0, 5),
                horaFin: valor("horaFin").substring(0, 5),
                duracionSlotMin: Number(valor("duracion"))
            }
        }
    });

    mostrarPantallaCorreo(valor("correo"), r?.correoEnviado);
}


// =====================================
// PANTALLA "REVISA TU CORREO"
// =====================================

let correoRegistrado = "";

function mostrarPantallaCorreo(correo, enviado) {
    correoRegistrado = correo;
    pantallaFormulario.classList.add("oculto");
    pantallaSeleccion.classList.add("oculto");
    document.getElementById("pantallaCorreo").classList.remove("oculto");

    const texto = document.getElementById("textoCorreoEnviado");
    texto.innerHTML = enviado === false
        ? `Tu cuenta quedó creada, pero no pudimos enviar el correo a <strong>${escaparHtml(correo)}</strong>. Presiona <strong>Reenviar correo</strong> en un minuto.`
        : `Te enviamos un enlace a <strong>${escaparHtml(correo)}</strong> para activar tu cuenta.`;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btnReenviarCorreo").addEventListener("click", async (e) => {
    const boton = e.currentTarget;
    const aviso = document.getElementById("mensajeReenvio");
    boton.disabled = true;
    try {
        const r = await apiFetch("/api/Auth/reenviar-verificacion", { method: "POST", body: { correo: correoRegistrado } });
        aviso.textContent = r?.respuesta || "Te enviamos un correo nuevo.";
        aviso.className = "alert alert-success mx-auto";
    } catch (error) {
        aviso.textContent = error.message;
        aviso.className = "alert alert-warning mx-auto";
    } finally {
        // Se puede volver a pedir después de un minuto
        setTimeout(() => { boton.disabled = false; }, 60000);
    }
});


// =====================================
// MENSAJES
// =====================================

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `alert alert-${tipo}`;
    mensaje.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ocultarMensaje() {
    mensaje.className = "alert d-none";
}
