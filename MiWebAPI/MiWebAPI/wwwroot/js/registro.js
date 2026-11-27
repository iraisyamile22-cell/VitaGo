
const pantallaSeleccion = document.getElementById("pantallaSeleccion");
const pantallaFormulario = document.getElementById("pantallaFormulario");

const formulario = document.getElementById("formRegistro");

const tipoUsuario = document.getElementById("tipoUsuario");
const datosMedico = document.getElementById("datosMedico");

const tituloFormulario = document.getElementById("tituloFormulario");
const descripcionFormulario = document.getElementById("descripcionFormulario");

const especialidad = document.getElementById("especialidad");
const cedula = document.getElementById("cedula");
const consultorio = document.getElementById("consultorio");
const direccion = document.getElementById("direccion");
const ciudad = document.getElementById("ciudad");
const horarios = document.getElementById("horarios");


// =====================================
// SELECCIONAR TIPO DE CUENTA
// =====================================

function seleccionarCuenta(tipo) {

    tipoUsuario.value = tipo;

    pantallaSeleccion.classList.add("oculto");
    pantallaFormulario.classList.remove("oculto");

    if (tipo === "medico") {

        tituloFormulario.textContent = "Registro de médico";

        descripcionFormulario.textContent =
            "Completa tus datos personales, profesionales y de tu consultorio.";

        datosMedico.classList.remove("oculto");

        // Campos médicos obligatorios
        especialidad.required = true;
        cedula.required = true;
        consultorio.required = true;
        direccion.required = true;
        ciudad.required = true;
        horarios.required = true;

    } else {

        tituloFormulario.textContent = "Registro de paciente";

        descripcionFormulario.textContent =
            "Completa tus datos personales para crear tu cuenta en vitaGo.";

        datosMedico.classList.add("oculto");

        // Campos médicos no obligatorios
        especialidad.required = false;
        cedula.required = false;
        consultorio.required = false;
        direccion.required = false;
        ciudad.required = false;
        horarios.required = false;

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// =====================================
// REGRESAR A LA SELECCIÓN
// =====================================

function regresarSeleccion() {

    formulario.reset();

    datosMedico.classList.add("oculto");

    pantallaFormulario.classList.add("oculto");
    pantallaSeleccion.classList.remove("oculto");

    tipoUsuario.value = "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// =====================================
// ENVÍO DEL FORMULARIO
// =====================================

formulario.addEventListener("submit", async function (e) {

    e.preventDefault();

    const boton = formulario.querySelector('button[type="submit"]');
    const textoOriginal = boton.innerHTML;

    const tipo = tipoUsuario.value;

    const contrasena = document.getElementById("contrasena").value;
    const confirmarContrasena = document.getElementById("confirmarContrasena").value;


    // Validar contraseñas
    if (contrasena !== confirmarContrasena) {

        alert("Las contraseñas no coinciden.");

        document.getElementById("confirmarContrasena").focus();

        return;

    }


    // Datos generales
    const datos = {

        nombre: document.getElementById("nombre").value.trim(),
        apellidos: document.getElementById("apellidos").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        contrasena: contrasena,
        tipoUsuario: tipo

    };


    // Agregar datos profesionales si es médico
    if (tipo === "medico") {

        datos.especialidad = especialidad.value;
        datos.cedula = cedula.value.trim();
        datos.consultorio = consultorio.value.trim();
        datos.direccion = direccion.value.trim();
        datos.ciudad = ciudad.value.trim();
        datos.horarios = horarios.value.trim();

    }


    try {

        boton.disabled = true;
        boton.innerHTML = "Registrando...";


        // API correspondiente
        const urlAPI = tipo === "medico"
            ? "/api/medicos/registro"
            : "/api/usuarios/registro";


        const respuesta = await fetch(urlAPI, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(datos)

        });


        if (respuesta.ok) {

            alert(
                tipo === "medico"
                    ? "¡Médico registrado correctamente!"
                    : "¡Paciente registrado correctamente!"
            );

            window.location.href = "login.html";

        } else {

            const errorData = await respuesta.json().catch(() => ({}));

            alert(
                errorData.message ||
                errorData.title ||
                "No se pudo completar el registro."
            );

            boton.disabled = false;
            boton.innerHTML = textoOriginal;

        }

    } catch (error) {

        console.error("Error en el registro:", error);

        alert("No se pudo conectar con el servidor.");

        boton.disabled = false;
        boton.innerHTML = textoOriginal;

    }

});

