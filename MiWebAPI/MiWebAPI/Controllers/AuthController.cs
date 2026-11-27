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
        private readonly VerificacionCorreoService _verificacion;

        public AuthController(AuthData authData, JwtService jwt, VerificacionCorreoService verificacion)
        {
            _authData = authData;
            _jwt = jwt;
            _verificacion = verificacion;
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

            // Hasta que no abra el enlace del correo, no puede entrar
            if (!await _authData.CorreoVerificado(u.UsuarioId))
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    NumeroError = 403,
                    Respuesta = "Aún no verificas tu correo. Abre el enlace que te enviamos para activar tu cuenta.",
                    RequiereVerificacion = true
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

        // POST api/auth/verificar  -> lo llama verificar.html con el token del enlace
        [HttpPost("verificar")]
        public async Task<IActionResult> VerificarCorreo([FromBody] VerificarCorreoRequest req)
        {
            RespuestaOperacion r = await _authData.VerificarCorreo(VerificacionCorreoService.Hash(req.Token.Trim()));
            return r.IsSuccess ? Ok(r) : BadRequest(r);   // 1 = enlace inválido, 2 = vencido
        }

        // POST api/auth/reenviar-verificacion  -> manda un enlace nuevo
        // Siempre responde lo mismo, para no revelar qué correos están registrados.
        [HttpPost("reenviar-verificacion")]
        public async Task<IActionResult> ReenviarVerificacion([FromBody] ReenviarVerificacionRequest req)
        {
            var (r, _) = await _verificacion.EnviarAsync(req.Correo.Trim(), Request);
            if (r.NumeroError == 3) return StatusCode(StatusCodes.Status429TooManyRequests, r); // espera 1 minuto

            return Ok(new RespuestaOperacion
            {
                NumeroError = 0,
                Respuesta = "Si tu cuenta existe y aún no está verificada, te enviamos un correo nuevo. Revisa también la carpeta de spam."
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