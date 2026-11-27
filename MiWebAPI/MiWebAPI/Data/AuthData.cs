using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace MiWebAPI.Data
{
    public class AuthData
    {
        private readonly string _conexion;
        private readonly ILogger<AuthData> _logger;

        public AuthData(IConfiguration configuration, ILogger<AuthData> logger)
        {
            _conexion = configuration.GetConnectionString("CadenaSQL")
                ?? throw new InvalidOperationException(
                    "Falta la cadena de conexión 'CadenaSQL' en appsettings.json");
            _logger = logger;
        }

        public async Task<UsuarioLogin?> ObtenerPorCorreo(string correo)
        {
            await using var con = new SqlConnection(_conexion);
            await con.OpenAsync();

            await using var cmd = new SqlCommand("sp_loginUsuario", con)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.Add(new SqlParameter("@Correo", SqlDbType.NVarChar, 254) { Value = correo });

            await using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return null;

            int iHash = r.GetOrdinal("PasswordHash");
            int iNombre = r.GetOrdinal("Nombre");
            int iPerfil = r.GetOrdinal("PerfilId");

            return new UsuarioLogin
            {
                UsuarioId = r.GetGuid(r.GetOrdinal("UsuarioId")),
                Correo = r.GetString(r.GetOrdinal("Correo")),
                PasswordHash = r.IsDBNull(iHash) ? null : r.GetString(iHash),
                Rol = r.GetString(r.GetOrdinal("Rol")),
                Nombre = r.IsDBNull(iNombre) ? null : r.GetString(iNombre),
                PerfilId = r.IsDBNull(iPerfil) ? null : r.GetGuid(iPerfil)
            };
        }

        // ---------- Cuenta del usuario que inició sesión ----------

        public Task<RespuestaOperacion> CambiarPassword(Guid usuarioId, string nuevoHash) =>
            Ejecutar("sp_cambiarPassword", p =>
            {
                p.Add(new SqlParameter("@UsuarioId", SqlDbType.UniqueIdentifier) { Value = usuarioId });
                p.Add(new SqlParameter("@PasswordHash", SqlDbType.VarChar, 255) { Value = nuevoHash });
            });

        public Task<RespuestaOperacion> EliminarUsuario(Guid usuarioId) =>
            Ejecutar("sp_eliminarUsuario", p =>
                p.Add(new SqlParameter("@UsuarioId", SqlDbType.UniqueIdentifier) { Value = usuarioId }));

        // ---------- Verificación de correo ----------

        // sp_generarTokenVerificacion: guarda el hash del token y marca la cuenta como "sin verificar".
        // Regresa también el nombre de la persona para saludarla en el correo.
        public async Task<(RespuestaOperacion resultado, string? nombre)> GenerarTokenVerificacion(
            string correo, string tokenHash, DateTime expiraUtc)
        {
            var nombre = new SqlParameter("@Nombre", SqlDbType.NVarChar, 80) { Direction = ParameterDirection.Output };
            RespuestaOperacion r = await Ejecutar("sp_generarTokenVerificacion", p =>
            {
                p.Add(new SqlParameter("@Correo", SqlDbType.NVarChar, 254) { Value = correo.Trim() });
                p.Add(new SqlParameter("@TokenHash", SqlDbType.Char, 64) { Value = tokenHash });
                p.Add(new SqlParameter("@ExpiraUtc", SqlDbType.DateTime2) { Value = expiraUtc });
                p.Add(nombre);
            });
            return (r, nombre.Value as string);
        }

        // sp_verificarCorreo: activa la cuenta si el token existe y no ha vencido
        public Task<RespuestaOperacion> VerificarCorreo(string tokenHash) =>
            Ejecutar("sp_verificarCorreo", p =>
                p.Add(new SqlParameter("@TokenHash", SqlDbType.Char, 64) { Value = tokenHash }));

        // sp_estadoVerificacion: ¿ya verificó su correo? (si algo falla, no se bloquea el login)
        public async Task<bool> CorreoVerificado(Guid usuarioId)
        {
            try
            {
                await using var con = new SqlConnection(_conexion);
                await using var cmd = new SqlCommand("sp_estadoVerificacion", con) { CommandType = CommandType.StoredProcedure };
                cmd.Parameters.Add(new SqlParameter("@UsuarioId", SqlDbType.UniqueIdentifier) { Value = usuarioId });
                await con.OpenAsync();
                object? valor = await cmd.ExecuteScalarAsync();
                return valor is not bool verificado || verificado;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al ejecutar sp_estadoVerificacion");
                return true;
            }
        }

        // Ejecuta un SP con los parámetros de salida @numeroError y @respuesta
        private async Task<RespuestaOperacion> Ejecutar(string procedimiento, Action<SqlParameterCollection> parametros)
        {
            try
            {
                await using var con = new SqlConnection(_conexion);
                await using var cmd = new SqlCommand(procedimiento, con) { CommandType = CommandType.StoredProcedure };
                parametros(cmd.Parameters);

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int) { Direction = ParameterDirection.Output };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

                await con.OpenAsync();
                await cmd.ExecuteNonQueryAsync();

                return new RespuestaOperacion
                {
                    NumeroError = numeroError.Value is int n ? n : 0,
                    Respuesta = respuesta.Value as string ?? string.Empty
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al ejecutar {Procedimiento}", procedimiento);
                return new RespuestaOperacion { NumeroError = -1, Respuesta = "Ocurrió un error al procesar la solicitud" };
            }
        }
    }
}