using System.Security.Cryptography;
using System.Text;
using MiWebAPI.Data;
using MiWebAPI.Models;

namespace MiWebAPI.Services
{
    // Genera el enlace de verificación, lo guarda en la base (solo su hash) y manda el correo.
    public class VerificacionCorreoService
    {
        public static readonly TimeSpan Vigencia = TimeSpan.FromHours(24);

        private readonly AuthData _authData;
        private readonly EmailService _email;
        private readonly IConfiguration _config;

        public VerificacionCorreoService(AuthData authData, EmailService email, IConfiguration config)
        {
            _authData = authData;
            _email = email;
            _config = config;
        }

        // SHA-256 del token: en la base nunca se guarda el token tal cual
        public static string Hash(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        // Crea un token nuevo y manda el correo. Devuelve el resultado del SP y si el correo salió.
        public async Task<(RespuestaOperacion resultado, bool enviado)> EnviarAsync(string correo, HttpRequest request)
        {
            // Token aleatorio de 32 bytes, seguro para ponerlo en una URL
            string token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');

            var (resultado, nombre) = await _authData.GenerarTokenVerificacion(
                correo, Hash(token), DateTime.UtcNow.Add(Vigencia));

            if (!resultado.IsSuccess) return (resultado, false);

            // La dirección pública se toma de la petición (localhost en tu compu, la URL de Azure allá).
            // Si algún día hace falta forzarla: "App": { "UrlPublica": "https://..." } en appsettings.
            string baseUrl = _config["App:UrlPublica"]?.TrimEnd('/') ?? $"{request.Scheme}://{request.Host}";
            string enlace = $"{baseUrl}/verificar.html?token={token}";

            bool enviado = await _email.SendVerificationEmailAsync(correo, nombre ?? correo, enlace);
            return (resultado, enviado);
        }
    }
}
