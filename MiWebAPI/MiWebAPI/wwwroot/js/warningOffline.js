
document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el elemento del banner
    const banner = document.createElement("div");
    banner.id = "offline-banner";

    // 2. Estilos en línea (o muévelos a tu archivo CSS)
    banner.style.cssText = `
        display: none; /* Oculto por defecto */
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: #f59e0b; /* Color ámbar/naranja */
        color: white;
        text-align: center;
        padding: 10px;
        font-family: sans-serif;
        font-weight: bold;
        z-index: 9999;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    banner.textContent = "Sin conexión a Internet. Revisa tu red.";

    // 3. Agregar el banner al cuerpo de la página
    document.body.appendChild(banner);

    // 4. Función para actualizar el estado
    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            banner.style.display = "none";
        } else {
            banner.style.display = "block";
        }
    };

    // 5. Escuchar los eventos de red
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // 6. Comprobar el estado inicial al cargar la página
    updateOnlineStatus();
});