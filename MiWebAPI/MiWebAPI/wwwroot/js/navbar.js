// 1. Aquí guardamos todo el diseño del menú ya en español y con sus enlaces
const menuHTML = `
    <nav class="vg-navbar-pistache">
        <!-- Logo (Redirige siempre al Inicio) -->
        <a href="index.html" style="display:flex; align-items:center; gap:12px; text-decoration:none;">
            <div style="background:#ecfdf5; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                <img src="/assets/img/vitago-icon.png" alt="vitaGo" style="width:24px;">
            </div>
            <div style="line-height:1;">
                <span style="font-weight:800; font-size:18px; color:#0f172a; display:block;">vitaGo</span>
                <span style="font-size:11px; font-weight:500; color:#64748b;">Citas médicas, simplificadas.</span>
            </div>
        </a>

        <!-- Links centrales en Español con sus rutas -->
        <div class="vg-nav-pistache-links d-none d-lg-flex">
            <a href="index.html">Inicio</a>
            <a href="index.html#medicos">Doctores</a>
            <a href="index.html#especialidades">Especialidades</a>
        </div>

        <!-- Botones de sesión (se rellenan según si el usuario inició sesión) -->
        <div id="vg-nav-sesion" style="display:flex; gap:10px; align-items:center;"></div>
    </nav>
`;

// Botones cuando NO hay sesión
const botonesInvitado = `
    <a href="login.html" class="btn" style="background:#fff; color:#0f172a; border:1px solid #e2e8f0; border-radius:20px; font-weight:600; padding:6px 20px;">
        Iniciar sesión
    </a>
    <a href="registro-medico.html" class="btn" style="background:#10b981; color:#fff; border-radius:20px; font-weight:600; padding:6px 20px; border: 1px solid #10b981;">
        Registrarse
    </a>
`;

// Lee la sesión directo de sessionStorage (misma clave que js/auth.js), así funciona
// también en páginas que no cargan auth.js
function leerSesionNavbar() {
    try {
        const sesion = JSON.parse(sessionStorage.getItem("vitago_sesion"));
        if (!sesion || (sesion.expiraEn && new Date(sesion.expiraEn) <= new Date())) return null;
        return sesion;
    } catch {
        return null;
    }
}

function pintarSesionNavbar() {
    const contenedor = document.getElementById("vg-nav-sesion");
    if (!contenedor) return;

    const sesion = leerSesionNavbar();
    if (!sesion) {
        contenedor.innerHTML = botonesInvitado;
        return;
    }

    const nombre = (sesion.nombre && sesion.nombre.trim()) || (sesion.correo || "").split("@")[0];

    const chip = document.createElement("a");
    chip.href = "editar-perfil.html";
    chip.title = "Ver mi perfil";
    chip.style.cssText = "background:#fff; color:#0f172a; border:1px solid #e2e8f0; border-radius:20px; font-weight:600; padding:6px 16px; font-size:14px; text-decoration:none;";    chip.textContent = "👤 " + nombre; // textContent evita inyectar HTML

    const salir = document.createElement("button");
    salir.type = "button";
    salir.className = "btn";
    salir.style.cssText = "background:#10b981; color:#fff; border-radius:20px; font-weight:600; padding:6px 20px; border:1px solid #10b981;";
    salir.textContent = "Cerrar sesión";
    salir.addEventListener("click", () => {
        sessionStorage.removeItem("vitago_sesion");
        window.location.replace("index.html");
    });

    contenedor.replaceChildren(chip, salir);
}

// 2. Esta función inyecta el menú cuando la página carga
document.addEventListener("DOMContentLoaded", () => {
    const contenedorMenu = document.getElementById("menu-dinamico");
    if (contenedorMenu) {
        contenedorMenu.innerHTML = menuHTML;
        pintarSesionNavbar();
    }
});