using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Data;
using MiWebAPI.Models;
using System.Security.Claims;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PacientesController : ControllerBase
    {
        private readonly PacientesData _data;

        public PacientesController(PacientesData data) => _data = data;

        // POST api/pacientes
        [HttpPost]
        public async Task<IActionResult> Registrar([FromBody] PacienteRegistro objeto)
        {
            RespuestaOperacion resultado = await _data.Registrar(objeto);
            return resultado.IsSuccess ? Ok(resultado) : BadRequest(resultado);
        }
        // El paciente siempre sale del token, nunca de la petición
        private Guid? PacienteActual() =>
            Guid.TryParse(User.FindFirstValue("perfil_id"), out Guid id) ? id : null;

        private IActionResult SesionInvalida() =>
            Unauthorized(new RespuestaOperacion
            {
                NumeroError = 401,
                Respuesta = "Tu sesión no tiene un perfil de paciente válido"
            });

        // GET api/pacientes/perfil  -> datos del paciente que inició sesión (sale del token)
        [Authorize(Roles = "paciente")]
        [HttpGet("perfil")]
        public async Task<IActionResult> MiPerfil()
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            PacientePerfil? perfil = await _data.ObtenerPerfil(pacienteId);

            return perfil is null
                ? NotFound(new RespuestaOperacion { NumeroError = 404, Respuesta = "No se encontró el perfil" })
                : Ok(perfil);
        }

        // PUT api/pacientes/perfil  -> el paciente edita sus propios datos (sp_editarPaciente)
        [Authorize(Roles = "paciente")]
        [HttpPut("perfil")]
        public async Task<IActionResult> EditarPerfil([FromBody] PacienteEditar objeto)
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            if (!FotoValida(objeto.FotoUrl))
                return BadRequest(new RespuestaOperacion
                {
                    NumeroError = 400,
                    Respuesta = "La foto debe ser una imagen JPG, PNG o WEBP"
                });

            RespuestaOperacion resultado = await _data.Editar(pacienteId, objeto);

            if (resultado.IsSuccess) return Ok(resultado);
            return resultado.NumeroError == 1 ? NotFound(resultado) : BadRequest(resultado);
        }

        // Solo se aceptan enlaces http(s) o imágenes en base64 (nada de "javascript:" ni otros formatos)
        private static bool FotoValida(string? foto)
        {
            if (string.IsNullOrWhiteSpace(foto)) return true;

            if (Uri.TryCreate(foto, UriKind.Absolute, out Uri? uri))
            {
                if (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) return foto.Length <= 500;
            }

            string[] prefijos = { "data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64," };
            string? prefijo = prefijos.FirstOrDefault(x => foto.StartsWith(x, StringComparison.OrdinalIgnoreCase));
            if (prefijo is null) return false;

            Span<byte> buffer = new byte[foto.Length];
            return Convert.TryFromBase64String(foto[prefijo.Length..], buffer, out _);
        }
    }
}
