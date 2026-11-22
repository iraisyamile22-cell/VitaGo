// Administración de médicos (solo rol admin). Requiere js/auth.js.
//   Lista:    GET    /api/doctores        (sp_listarDoctores)
//   Crear:    POST   /api/doctores        (sp_crearDoctor)
//   Editar:   PUT    /api/doctores/{id}   (sp_editarDoctor)
//   Eliminar: DELETE /api/doctores/{id}   (sp_eliminarDoctor)
const adminActual = requerirSesion("admin");

const formulario = document.getElementById("formDoctor");
const tabla = document.getElementById("tablaDoctores");
const filtro = document.getElementById("txtFiltro");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnRecargar = document.getElementById("btnRecargar");
let doctores = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!adminActual) return;
    formulario.addEventListener("submit", guardarDoctor);
    filtro.addEventListener("input", aplicarFiltro);
    btnCancelar.addEventListener("click", limpiarFormulario);
    btnRecargar.addEventListener("click", obtenerDoctores);
    tabla.addEventListener("click", (e) => {
        const boton = e.target.closest("button[data-accion]");
        if (!boton) return;
        if (boton.dataset.accion === "editar") cargarEnFormulario(boton.dataset.id);
        if (boton.dataset.accion === "eliminar") eliminarDoctor(boton.dataset.id);
    });

    cargarEspecialidades();
    obtenerDoctores();
});

async function cargarEspecialidades() {
    try {
        const lista = await apiFetch("/api/especialidades");
        document.getElementById("listaEspecialidades").innerHTML =
            lista.map((e) => `<option value="${escaparHtml(e.nombre)}"></option>`).join("");
    } catch { /* texto libre */ }
}

async function obtenerDoctores() {
    btnRecargar.disabled = true;
    btnRecargar.textContent = "Cargando...";
    try {
        doctores = await apiFetch("/api/doctores");
        aplicarFiltro();
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    } finally {
        btnRecargar.disabled = false;
        btnRecargar.textContent = "Recargar";
    }
}

function aplicarFiltro() {
    const texto = filtro.value.trim().toLowerCase();
    const lista = doctores.filter((d) =>
        [`${d.nombre} ${d.apellidos}`, d.especialidad, d.correo, d.cedula]
            .some((v) => (v ?? "").toLowerCase().includes(texto)));
    mostrarDoctores(lista);
}

function mostrarDoctores(lista) {
    document.getElementById("sinResultados").classList.toggle("d-none", lista.length > 0);
    tabla.innerHTML = lista.map((d) => `
        <tr>
            <td><a href="perfil-medico.html?id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">${escaparHtml(`${d.nombre ?? ""} ${d.apellidos ?? ""}`)}</a></td>
            <td>${escaparHtml(d.especialidad ?? "—")}</td>
            <td>${escaparHtml(d.cedula)}</td>
            <td>${escaparHtml(d.correo)}</td>
            <td>${escaparHtml(d.telefono ?? "—")}</td>
            <td><span class="badge ${d.estadoRegistro === "aprobado" ? "text-bg-success" : "text-bg-secondary"}">${escaparHtml(d.estadoRegistro ?? "—")}</span></td>
            <td class="text-end">${formatoMoneda(d.precioConsulta)}</td>
            <td class="text-center text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-primary" data-accion="editar" data-id="${escaparHtml(d.id)}">Editar</button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-accion="eliminar" data-id="${escaparHtml(d.id)}">Eliminar</button>
            </td>
        </tr>`).join("");
}

function modoEdicion(editando) {
    document.querySelectorAll(".solo-nuevo").forEach((el) => el.classList.toggle("d-none", editando));
    document.getElementById("especialidad").disabled = editando;
    document.getElementById("notaEspecialidad").classList.toggle("d-none", !editando);
    document.getElementById("tituloFormulario").textContent = editando ? "Editar doctor" : "Nuevo doctor";
    btnGuardar.textContent = editando ? "Actualizar" : "Guardar";
    btnCancelar.classList.toggle("d-none", !editando);
}

function cargarEnFormulario(id) {
    const d = doctores.find((x) => x.id === id);
    if (!d) return;
    const poner = (campo, v) => { document.getElementById(campo).value = v ?? ""; };
    poner("idDoctor", d.id);
    poner("nombre", d.nombre);
    poner("apellidos", d.apellidos);
    poner("especialidad", d.especialidad);
    poner("cedula", d.cedula);
    poner("correo", d.correo);
    poner("telefono", d.telefono);
    poner("precioConsulta", d.precioConsulta);
    poner("aniosExperiencia", d.aniosExperiencia);
    poner("idiomas", d.idiomas);
    poner("bio", d.bio);
    document.getElementById("consultaOnline").checked = !!d.consultaOnline;
    modoEdicion(true);
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
}

function limpiarFormulario() {
    formulario.reset();
    formulario.classList.remove("was-validated");
    document.getElementById("idDoctor").value = "";
    modoEdicion(false);
}

const valor = (id) => document.getElementById(id).value.trim();

async function guardarDoctor(e) {
    e.preventDefault();
    const id = valor("idDoctor");
    const esNuevo = !id;

    if (!formulario.checkValidity()) { formulario.classList.add("was-validated"); return; }

    const comunes = {
        nombre: valor("nombre"),
        apellidos: valor("apellidos"),
        cedula: valor("cedula"),
        correo: valor("correo"),
        telefono: valor("telefono") || null,
        precioConsulta: Number(valor("precioConsulta")),
        aniosExperiencia: Number(valor("aniosExperiencia") || 0),
        idiomas: valor("idiomas") || null,
        bio: valor("bio") || null,
        consultaOnline: document.getElementById("consultaOnline").checked
    };

    let peticion;
    if (esNuevo) {
        if (document.getElementById("password").value.length < 8)
            return mostrarMensaje("La contraseña inicial debe tener al menos 8 caracteres.", "warning");
        if (!valor("consultorio") || !valor("direccionConsultorio") || !valor("ciudadConsultorio"))
            return mostrarMensaje("Para crear un médico captura el nombre, la dirección y la ciudad del consultorio.", "warning");

        peticion = apiFetch("/api/doctores", {
            method: "POST",
            body: {
                ...comunes,
                password: document.getElementById("password").value,
                especialidad: valor("especialidad"),
                consultorio: {
                    nombre: valor("consultorio"),
                    direccion: valor("direccionConsultorio"),
                    ciudad: valor("ciudadConsultorio"),
                    cp: valor("cpConsultorio") || null,
                    diaInicio: 1,
                    diaFin: 5,
                    horaInicio: valor("horaInicio").substring(0, 5),
                    horaFin: valor("horaFin").substring(0, 5),
                    duracionSlotMin: 30
                }
            }
        });
    } else {
        const actual = doctores.find((d) => d.id === id);
        peticion = apiFetch(`/api/doctores/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: { ...actual, ...comunes, id, especialidad: actual?.especialidad || "Medicina general" }
        });
    }

    btnGuardar.disabled = true;
    try {
        const resultado = await peticion;
        mostrarMensaje(resultado?.respuesta || "Cambios guardados", "success");
        limpiarFormulario();
        await obtenerDoctores();
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    } finally {
        btnGuardar.disabled = false;
    }
}

async function eliminarDoctor(id) {
    const d = doctores.find((x) => x.id === id);
    if (!confirm(`¿Dar de baja al Dr. ${d?.nombre ?? ""} ${d?.apellidos ?? ""}? Se cancelarán sus citas próximas.`)) return;
    try {
        const resultado = await apiFetch(`/api/doctores/${encodeURIComponent(id)}`, { method: "DELETE" });
        mostrarMensaje(resultado?.respuesta || "Doctor eliminado", "success");
        await obtenerDoctores();
    } catch (error) {
        mostrarMensaje(error.message, "danger");
    }
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensaje");
    caja.textContent = texto;
    caja.className = `alert alert-${tipo}`;
    clearTimeout(mostrarMensaje.t);
    mostrarMensaje.t = setTimeout(() => caja.classList.add("d-none"), 6000);
}
