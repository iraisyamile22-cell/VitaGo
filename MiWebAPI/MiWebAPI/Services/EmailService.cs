using System.Net.Mail;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace MiWebAPI.Services
{
    public class SmtpSettings
    {
        public string Host { get; set; }
        public int Port { get; set; }
        public string SenderName { get; set; }
        public string SenderEmail { get; set; }
        public string Password { get; set; }
    }

    public class EmailService
    {
        private readonly SmtpSettings _settings;

        public EmailService(IOptions<SmtpSettings> settings)
        {
            _settings = settings.Value;
        }

        public async Task SendVerificationEmailAsync(string toEmail, string toName, string verificationLink)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Verifica tu cuenta en vitaGo";

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = $@"
                    <h2>¡Bienvenido/a a vitaGo, {toName}!</h2>
                    <p>Para activar tu cuenta, por favor haz clic en el siguiente enlace:</p>
                    <p><a href='{verificationLink}' style='padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;'>Verificar mi cuenta</a></p>
                    <p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>"
            };

            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
    }
}