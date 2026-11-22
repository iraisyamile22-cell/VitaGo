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

            RespuestaOperacion resultado = await _data.Editar(pacienteId, objeto);

            if (resultado.IsSuccess) return Ok(resultado);
            return resultado.NumeroError == 1 ? NotFound(resultado) : BadRequest(resultado);
        }
    }
}