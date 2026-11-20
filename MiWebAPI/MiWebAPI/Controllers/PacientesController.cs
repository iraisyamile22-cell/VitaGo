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
        // GET api/pacientes/perfil  -> datos del paciente que inició sesión (sale del token)
        [Authorize(Roles = "paciente")]
        [HttpGet("perfil")]
        public async Task<IActionResult> MiPerfil()
        {
            if (!Guid.TryParse(User.FindFirstValue("perfil_id"), out Guid pacienteId))
                return Unauthorized(new RespuestaOperacion
                {
                    NumeroError = 401,
                    Respuesta = "Tu sesión no tiene un perfil de paciente válido"
                });

            PacientePerfil? perfil = await _data.ObtenerPerfil(pacienteId);

            return perfil is null
                ? NotFound(new RespuestaOperacion { NumeroError = 404, Respuesta = "No se encontró el perfil" })
                : Ok(perfil);
        }
    }
}