using System.ComponentModel.DataAnnotations;

namespace MiWebAPI.Models
{
    // PUT api/pacientes/perfil  (el correo no se edita aquí)
    public class PacienteEditar
    {
        [Required, StringLength(80)]
        public string Nombre { get; set; } = string.Empty;

        [StringLength(120)]
        public string? Apellidos { get; set; }

        [StringLength(20)]
        public string? Telefono { get; set; }

        public DateTime? FechaNacimiento { get; set; }

        [StringLength(20)]
        public string? Genero { get; set; }

        [StringLength(500)]
        public string? FotoUrl { get; set; }
    }

    // POST api/auth/cambiar-password
    public class CambiarPasswordRequest
    {
        [Required, StringLength(72)]
        public string PasswordActual { get; set; } = string.Empty;

        [Required, StringLength(72, MinimumLength = 8)]
        public string PasswordNueva { get; set; } = string.Empty;
    }

    // DELETE api/auth/cuenta  (se pide la contraseña para confirmar)
    public class EliminarCuentaRequest
    {
        [Required, StringLength(72)]
        public string Password { get; set; } = string.Empty;
    }
}
