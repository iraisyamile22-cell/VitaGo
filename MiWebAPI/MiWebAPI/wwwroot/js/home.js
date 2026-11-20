// Saludo en el index cuando el usuario ya inició sesión (auth.js define obtenerUsuario y saludoSegunHora)
document.addEventListener("DOMContentLoaded", () => {
    const saludo = document.getElementById("saludoUsuario");
    if (!saludo || typeof obtenerUsuario !== "function") return;

    const usuario = obtenerUsuario();
    if (!usuario) return;

    document.getElementById("saludoTexto").textContent =
        `¡${saludoSegunHora()}, ${nombreParaMostrar(usuario)}!`;
    saludo.classList.remove("d-none");
});

function buscarMedicos() {
    const ubicacion = document.querySelectorAll(".vg-field-input")[0].value;
    const especialidad = document.querySelectorAll(".vg-field-input")[1].value;
    const fecha = document.querySelectorAll(".vg-field-input")[2].value;
    // TODO: conectar con el endpoint de búsqueda de la API (GET /api/medicos?...)
    console.log("Buscar médicos:", { ubicacion, especialidad, fecha });
}

function agendarCita(medicoId) {
    window.location.href = `agendar-cita.html?medico=${encodeURIComponent(medicoId)}`;
}
