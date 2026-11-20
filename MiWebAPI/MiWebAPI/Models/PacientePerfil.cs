namespace MiWebAPI.Models
{
    public class PacientePerfil
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Apellidos { get; set; }
        public string? Telefono { get; set; }
        public DateTime? FechaNacimiento { get; set; }
        public string? Genero { get; set; }
        public string? FotoUrl { get; set; }
    }
}