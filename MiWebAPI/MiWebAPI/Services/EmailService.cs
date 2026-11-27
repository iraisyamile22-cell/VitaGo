using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace MiWebAPI.Services
{
    // Datos del servidor de correo. Van en appsettings.json (sección "SmtpSettings"),
    // EXCEPTO la contraseña, que va en user-secrets (local) o en la configuración de Azure.
    public class SmtpSettings
    {
        public string Host { get; set; } = "smtp.gmail.com";
        public int Port { get; set; } = 587;
        public string SenderName { get; set; } = "vitaGo";
        public string SenderEmail { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    // Envío de correos (diseño original de Ayelen). Usa System.Net.Mail, que ya viene con .NET,
    // así no hace falta instalar ningún paquete extra.
    public class EmailService
    {
        private readonly SmtpSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IOptions<SmtpSettings> settings, ILogger<EmailService> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        // ¿Está configurado el correo? (sin contraseña no se puede enviar)
        public bool Configurado =>
            !string.IsNullOrWhiteSpace(_settings.SenderEmail) && !string.IsNullOrWhiteSpace(_settings.Password);

        // Devuelve true si el correo se envió
        public async Task<bool> SendVerificationEmailAsync(string toEmail, string toName, string verificationLink)
        {
            if (!Configurado)
            {
                // Sin SMTP configurado (por ejemplo, en tu compu sin user-secrets) el enlace sale
                // en la consola de Visual Studio para poder probar igual.
                _logger.LogWarning("SMTP sin configurar. Enlace de verificación para {Correo}: {Enlace}", toEmail, verificationLink);
                return false;
            }

            string nombre = WebUtility.HtmlEncode(toName);
            string enlace = WebUtility.HtmlEncode(verificationLink);

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = "Verifica tu cuenta en vitaGo",
                IsBodyHtml = true,
                Body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 520px; margin: auto; color: #0f172a;'>
                        <h2 style='color: #0e5a35;'>¡Bienvenido/a a vitaGo, {nombre}!</h2>
                        <p>Para activar tu cuenta, por favor haz clic en el siguiente enlace:</p>
                        <p style='margin: 28px 0;'>
                            <a href='{enlace}' style='padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;'>Verificar mi cuenta</a>
                        </p>
                        <p style='font-size: 13px; color: #64748b;'>El enlace vence en 24 horas. Si el botón no funciona, copia esta dirección en tu navegador:<br>{enlace}</p>
                        <p style='font-size: 13px; color: #64748b;'>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
                    </div>"
            };
            message.To.Add(new MailAddress(toEmail, toName));

            try
            {
                using var client = new SmtpClient(_settings.Host, _settings.Port)
                {
                    EnableSsl = true, // STARTTLS en el puerto 587
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    UseDefaultCredentials = false,
                    Credentials = new NetworkCredential(_settings.SenderEmail, _settings.Password),
                    Timeout = 15000
                };
                await client.SendMailAsync(message);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo enviar el correo de verificación a {Correo}", toEmail);
                return false;
            }
        }
    }
}
