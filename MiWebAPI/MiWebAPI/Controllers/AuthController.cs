using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Data;
using MiWebAPI.Models;
using MiWebAPI.Services;
using System.Security.Claims;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        // Se compara contra este hash cuando el correo no existe, para que
        // la respuesta tarde lo mismo y no se pueda averiguar qué correos están registrados
        private static readonly string HashFalso =
            BCrypt.Net.BCrypt.HashPassword("contrasena-falsa-para-igualar-tiempos");

        private readonly AuthData _authData;
        private readonly JwtService _jwt;

        public AuthController(AuthData authData, JwtService jwt)
        {
            _authData = authData;
            _jwt = jwt;
        }

        // POST api/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            UsuarioLogin? u = await _authData.ObtenerPorCorreo(req.Correo.Trim());

            bool valida = Verificar(req.Password, u?.PasswordHash ?? HashFalso);

            if (u is null || u.PasswordHash is null || !valida)
                return Unauthorized(new RespuestaOperacion
                {
                    NumeroError = 401,
                    Respuesta = "Correo o contraseña incorrectos"
                });

            var (token, expira) = _jwt.Generar(u);

            return Ok(new LoginRespuesta
            {
                Token = token,
                ExpiraEn = expira,
                UsuarioId = u.UsuarioId,
                PerfilId = u.PerfilId,
                Rol = u.Rol,
                Nombre = u.Nombre,
                Correo = u.Correo
            });
        }

        // GET api/auth/yo  (sirve para comprobar que el token funciona)
        [Authorize]
        [HttpGet("yo")]
        public IActionResult Yo() => Ok(new
        {
            UsuarioId = User.FindFirstValue("sub"),
            Rol = User.FindFirstValue("role"),
            PerfilId = User.FindFirstValue("perfil_id")
        });

        // POST api/auth/cambiar-password  (cualquier rol; pide la contraseña actual)
        [Authorize]
        [HttpPost("cambiar-password")]
        public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordRequest req)
        {
            if (await UsuarioConPasswordValida(req.PasswordActual) is not UsuarioLogin u)
                return Unauthorized(new RespuestaOperacion { NumeroError = 401, Respuesta = "La contraseña actual no es correcta" });

            string hash = BCrypt.Net.BCrypt.HashPassword(req.PasswordNueva);
            RespuestaOperacion resultado = await _authData.CambiarPassword(u.UsuarioId, hash);
            return resultado.IsSuccess ? Ok(resultado) : BadRequest(resultado);
        }

        // DELETE api/auth/cuenta  (cualquier rol; baja lógica con sp_eliminarUsuario)
        [Authorize]
        [HttpDelete("cuenta")]
        public async Task<IActionResult> EliminarCuenta([FromBody] EliminarCuentaRequest req)
        {
            if (await UsuarioConPasswordValida(req.Password) is not UsuarioLogin u)
                return Unauthorized(new RespuestaOperacion { NumeroError = 401, Respuesta = "La contraseña no es correcta" });

            RespuestaOperacion resultado = await _authData.EliminarUsuario(u.UsuarioId);
            return resultado.IsSuccess ? Ok(resultado) : BadRequest(resultado);
        }

        // Busca al usuario del token y comprueba su contraseña. Null si algo no coincide.
        private async Task<UsuarioLogin?> UsuarioConPasswordValida(string password)
        {
            string? correo = User.FindFirstValue("email");
            if (string.IsNullOrEmpty(correo) || !Guid.TryParse(User.FindFirstValue("sub"), out Guid usuarioId))
                return null;

            UsuarioLogin? u = await _authData.ObtenerPorCorreo(correo);
            if (u is null || u.UsuarioId != usuarioId || u.PasswordHash is null) return null;

            return Verificar(password, u.PasswordHash) ? u : null;
        }

        private static bool Verificar(string password, string hash)
        {
            try { return BCrypt.Net.BCrypt.Verify(password, hash); }
            catch (Exception) { return false; } // hash inválido (p. ej. datos de ejemplo)
        }
    }
}