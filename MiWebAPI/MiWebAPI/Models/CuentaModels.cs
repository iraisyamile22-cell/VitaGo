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

        // Enlace http(s) o imagen subida desde el dispositivo (data:image/jpeg;base64,...)
        // La página la manda recortada a 300x300 (~40 KB); el límite deja margen.
        [StringLength(400_000)]
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

    // POST api/auth/verificar  (el token llega en el enlace del correo)
    public class VerificarCorreoRequest
    {
        [Required, StringLength(100)]
        public string Token { get; set; } = string.Empty;
    }

    // POST api/auth/reenviar-verificacion
    public class ReenviarVerificacionRequest
    {
        [Required, EmailAddress, StringLength(254)]
        public string Correo { get; set; } = string.Empty;
    }

    // Respuesta de los registros (paciente y médico): dice si salió el correo de verificación
    public class RegistroRespuesta : RespuestaOperacion
    {
        public bool CorreoEnviado { get; set; }
    }

    // DELETE api/auth/cuenta  (se pide la contraseña para confirmar)
    public class EliminarCuentaRequest
    {
        [Required, StringLength(72)]
        public string Password { get; set; } = string.Empty;
    }
}
