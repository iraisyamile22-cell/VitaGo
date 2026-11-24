using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Data;
using MiWebAPI.Models;
using System.Security.Claims;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "paciente")]
    public class CitasController : ControllerBase
    {
        private readonly CitasData _data;

        public CitasController(CitasData data) => _data = data;

        // El paciente siempre sale del token, nunca de la petición
        private Guid? PacienteActual() =>
            Guid.TryParse(User.FindFirstValue("perfil_id"), out Guid id) ? id : null;

        private IActionResult SesionInvalida() =>
            Unauthorized(new RespuestaOperacion
            {
                NumeroError = 401,
                Respuesta = "Tu sesión no tiene un perfil de paciente válido"
            });

        // GET api/citas  -> mis citas (de la más reciente a la más antigua)
        [HttpGet]
        public async Task<IActionResult> MisCitas()
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            return Ok(await _data.MisCitas(pacienteId));
        }

        // GET api/citas/resenadas  -> ids de mis citas que ya califiqué
        [HttpGet("resenadas")]
        public async Task<IActionResult> Resenadas()
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            return Ok(await _data.CitasResenadas(pacienteId));
        }

        // POST api/citas/{id}/resena  -> calificar al médico de una cita ya pasada (sp_crearResena)
        [HttpPost("{id:guid}/resena")]
        public async Task<IActionResult> Resena(Guid id, [FromBody] ResenaCrear objeto)
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            RespuestaOperacion resultado = await _data.CrearResena(id, pacienteId, objeto);

            return resultado.NumeroError switch
            {
                0 => Ok(resultado),
                1 => NotFound(resultado),       // la cita no existe o no es suya
                4 => Conflict(resultado),       // ya la calificó
                _ => BadRequest(resultado)
            };
        }

        // GET api/citas/{id}  -> detalle (pantalla de confirmación)
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> Obtener(Guid id)
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            CitaDetalle? cita = await _data.Obtener(id, pacienteId);

            if (cita is null)
                return NotFound(new RespuestaOperacion { NumeroError = 404, Respuesta = "La cita no existe" });

            return Ok(cita);
        }

        // POST api/citas  -> reservar
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CitaCrear objeto)
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            if (objeto.MedicoId == Guid.Empty)
                return BadRequest(new RespuestaOperacion { NumeroError = 400, Respuesta = "Falta el medicoId" });

            ResultadoCita resultado = await _data.Crear(pacienteId, objeto);

            return resultado.NumeroError switch
            {
                0 => Ok(resultado),
                7 => Conflict(resultado),      // horario ya reservado
                _ => BadRequest(resultado)
            };
        }

        // POST api/citas/{id}/cancelar  -> cancelar (hasta 24 h antes)
        [HttpPost("{id:guid}/cancelar")]
        public async Task<IActionResult> Cancelar(Guid id)
        {
            if (PacienteActual() is not Guid pacienteId) return SesionInvalida();

            RespuestaOperacion resultado = await _data.Cancelar(id, pacienteId);

            if (resultado.IsSuccess) return Ok(resultado);
            return resultado.NumeroError == 1 ? NotFound(resultado) : BadRequest(resultado);
        }
    }
}