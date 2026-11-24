// Comprobante de la cita: GET /api/citas/{id} (sp_obtenerCita). Requiere js/auth.js.
// URL: confirmacion.html?id=<idCita>
requerirSesion("paciente");

document.addEventListener("DOMContentLoaded", async () => {
    // Aviso que pudo dejar agendar-cita.html (p. ej. al reprogramar)
    const aviso = sessionStorage.getItem("vitago_aviso");
    if (aviso) { mostrarMensaje(aviso, "warning"); sessionStorage.removeItem("vitago_aviso"); }

    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
        mostrarMensaje("No se indicó la cita. Revisa tus citas desde tu panel.", "warning");
        return;
    }

    let cita;
    try {
        cita = await apiFetch(`/api/citas/${encodeURIComponent(id)}`);
    } catch (error) {
        mostrarMensaje(error.message, "danger");
        return;
    }

    const estado = cita.estado ? cita.estado[0].toUpperCase() + cita.estado.slice(1) : "—";
    const valores = {
        folio: cita.folio,
        estado,
        paciente: cita.paciente,
        fecha: formatoFecha(cita.fechaHora),
        hora: `${formatoHora(cita.fechaHora)} • ${cita.duracionMin} min`,
        doctor: `Dr. ${cita.doctor}`,
        especialidad: cita.especialidad ?? "Medicina general",
        modalidad: cita.modalidad === "video" ? "Videoconsulta" : "Presencial",
        direccion: cita.modalidad === "video"
            ? "En línea (recibirás el enlace por correo)"
            : [cita.consultorio, cita.direccion, cita.ciudad].filter(Boolean).join(", ") || "—",
        costo: formatoMoneda(cita.costo, cita.moneda || "MXN")
    };
    document.querySelectorAll("[data-campo]").forEach((el) => {
        el.textContent = valores[el.dataset.campo] ?? "—";
    });

    // Si la cita ya no está confirmada, el encabezado lo dice
    if (cita.estado && cita.estado !== "confirmada") {
        document.getElementById("tituloCita").textContent = `Cita ${cita.estado}`;
        document.getElementById("subtituloCita").textContent = "Este es el comprobante de tu cita.";
        document.querySelector(".success-circle")?.style.setProperty("opacity", "0.4");
    }

    const boton = document.getElementById("btn-descargar");
    boton.disabled = false;
    boton.addEventListener("click", () => descargarPdf(cita.folio));
});

function descargarPdf(folio) {
    const elemento = document.getElementById("comprobante");
    const zonaBotones = document.getElementById("zona-botones");
    zonaBotones.style.display = "none";

    html2pdf().set({
        margin: 0.5,
        filename: `Comprobante_Cita_${folio || "vitaGo"}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    }).from(elemento).save().then(() => {
        zonaBotones.style.display = "flex";
    });
}

function mostrarMensaje(texto, tipo) {
    const caja = document.getElementById("mensaje");
    caja.textContent = texto;
    caja.className = `alert alert-${tipo}`;
}
