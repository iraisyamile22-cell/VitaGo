// Requiere js/auth.js
protegerPagina(); // si no hay sesión, manda al login

document.addEventListener("DOMContentLoaded", async () => {
    const usuario = obtenerUsuario();
    if (!usuario) return;

    // Lo que ya tenemos de la sesión
    pintarNombre(nombreParaMostrar(usuario));
    document.getElementById("perfilCorreo").textContent = usuario.correo;
    document.getElementById("inpCorreo").value = usuario.correo;

    if (usuario.rol !== "paciente") return; // por ahora solo pacientes tienen este perfil

    try {
        const respuesta = await fetch("/api/Pacientes/perfil", {
            headers: { Authorization: `Bearer ${obtenerToken()}` }
        });

        if (respuesta.status === 401) { cerrarSesion(); return; } // token vencido
        if (!respuesta.ok) throw new Error(`No se pudo cargar tu perfil (error ${respuesta.status}).`);

        const p = await respuesta.json();
        pintarNombre(`${p.nombre} ${p.apellidos ?? ""}`.trim());
        document.getElementById("inpNombre").value = p.nombre ?? "";
        document.getElementById("inpApellidos").value = p.apellidos ?? "";
        document.getElementById("inpTelefono").value = p.telefono ?? "";
        document.getElementById("inpFechaNac").value = p.fechaNacimiento ? p.fechaNacimiento.substring(0, 10) : "";
        document.getElementById("inpGenero").value = (p.genero ?? "").toLowerCase();
    } catch (error) {
        const aviso = document.getElementById("perfilMensaje");
        aviso.textContent = error.message;
        aviso.classList.remove("d-none");
    }
});

function pintarNombre(nombreCompleto) {
    document.getElementById("perfilNombre").textContent = nombreCompleto;
    const iniciales = nombreCompleto.split(" ").filter(Boolean).slice(0, 2)
        .map(palabra => palabra[0].toUpperCase()).join("");
    document.getElementById("perfilIniciales").textContent = iniciales || "👤";
}