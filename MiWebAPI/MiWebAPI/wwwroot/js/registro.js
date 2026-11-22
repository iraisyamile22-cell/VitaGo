// Registro de cuenta (diseño de Ayelen: primero se elige Paciente o Médico).
// Requiere js/auth.js (apiFetch, guardarSesion, escaparHtml).
//   Paciente: POST /api/Pacientes (sp_registrarPaciente) -> POST /api/Auth/login
//             -> PUT /api/Pacientes/perfil para guardar el teléfono (sp_editarPaciente)
//   Médico:   POST /api/doctores (sp_crearDoctor). Queda "pendiente" hasta que un admin lo apruebe.
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

    await apiFetch("/api/Pacientes", {
        method: "POST",
        body: { correo, password: contrasena, nombre: valor("nombre"), apellidos: valor("apellidos") }
    });

    // Cuenta creada: se inicia sesión automáticamente
    const sesion = await apiFetch("/api/Auth/login", { method: "POST", body: { correo, password: contrasena } });
    guardarSesion(sesion);

    // sp_registrarPaciente no recibe teléfono; si lo escribió se guarda en su perfil
    const telefono = opcional("telefono");
    if (telefono) {
        try {
            await apiFetch("/api/Pacientes/perfil", {
                method: "PUT",
                body: { nombre: valor("nombre"), apellidos: valor("apellidos"), telefono }
            });
        } catch { /* la cuenta ya existe; el teléfono se puede agregar después en "Mi perfil" */ }
    }

    window.location.replace("index.html");
}

async function registrarMedico(contrasena) {
    const diaInicio = Number(valor("diaInicio"));
    const diaFin = Number(valor("diaFin"));
    if (diaFin < diaInicio) throw new Error("El día final del horario no puede ser antes del día inicial.");
    if (valor("horaFin") <= valor("horaInicio")) throw new Error("La hora de salida debe ser después de la hora de entrada.");

    await apiFetch("/api/doctores", {
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

    window.location.href = "login.html?aviso=registro-medico";
}


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
