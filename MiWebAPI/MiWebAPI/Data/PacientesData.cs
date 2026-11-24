using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace MiWebAPI.Data
{
    public class PacientesData
    {
        private readonly string _conexion;
        private readonly ILogger<PacientesData> _logger;

        public PacientesData(IConfiguration configuration, ILogger<PacientesData> logger)
        {
            _conexion = configuration.GetConnectionString("CadenaSQL")
                ?? throw new InvalidOperationException(
                    "Falta la cadena de conexión 'CadenaSQL' en appsettings.json");
            _logger = logger;
        }

        public async Task<RespuestaOperacion> Registrar(PacienteRegistro p)
        {
            string hash = BCrypt.Net.BCrypt.HashPassword(p.Password);

            try
            {
                await using var con = new SqlConnection(_conexion);
                await using var cmd = new SqlCommand("sp_registrarPaciente", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("@Correo", p.Correo.Trim());
                cmd.Parameters.AddWithValue("@PasswordHash", hash);
                cmd.Parameters.AddWithValue("@Nombre", p.Nombre.Trim());
                cmd.Parameters.AddWithValue("@Apellidos", p.Apellidos.Trim());

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                { Direction = ParameterDirection.Output };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
                { Direction = ParameterDirection.Output };
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
                _logger.LogError(ex, "Error al ejecutar sp_registrarPaciente");
                return new RespuestaOperacion
                {
                    NumeroError = -1,
                    Respuesta = "Ocurrió un error al procesar la solicitud"
                };
            }
        }

        public async Task<RespuestaOperacion> Editar(Guid pacienteId, PacienteEditar p)
        {
            try
            {
                await using var con = new SqlConnection(_conexion);
                await using var cmd = new SqlCommand("sp_editarPaciente", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                object Nulo(string? v) => string.IsNullOrWhiteSpace(v) ? DBNull.Value : v.Trim();

                cmd.Parameters.Add(new SqlParameter("@PacienteId", SqlDbType.UniqueIdentifier) { Value = pacienteId });
                cmd.Parameters.Add(new SqlParameter("@Nombre", SqlDbType.NVarChar, 80) { Value = p.Nombre.Trim() });
                cmd.Parameters.Add(new SqlParameter("@Apellidos", SqlDbType.NVarChar, 120) { Value = Nulo(p.Apellidos) });
                cmd.Parameters.Add(new SqlParameter("@Telefono", SqlDbType.NVarChar, 20) { Value = Nulo(p.Telefono) });
                cmd.Parameters.Add(new SqlParameter("@FechaNacimiento", SqlDbType.Date)
                { Value = p.FechaNacimiento.HasValue ? p.FechaNacimiento.Value.Date : DBNull.Value });
                cmd.Parameters.Add(new SqlParameter("@Genero", SqlDbType.NVarChar, 20) { Value = Nulo(p.Genero) });
                cmd.Parameters.Add(new SqlParameter("@FotoUrl", SqlDbType.NVarChar, -1) { Value = Nulo(p.FotoUrl) }); // NVARCHAR(MAX)

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                { Direction = ParameterDirection.Output };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
                { Direction = ParameterDirection.Output };
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
                _logger.LogError(ex, "Error al ejecutar sp_editarPaciente");
                return new RespuestaOperacion
                {
                    NumeroError = -1,
                    Respuesta = "Ocurrió un error al procesar la solicitud"
                };
            }
        }

        public async Task<PacientePerfil?> ObtenerPerfil(Guid pacienteId)
        {
            await using var con = new SqlConnection(_conexion);
            await using var cmd = new SqlCommand("sp_perfilPaciente", con)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.Add(new SqlParameter("@PacienteId", SqlDbType.UniqueIdentifier) { Value = pacienteId });

            await con.OpenAsync();
            await using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return null;

            // Lee una columna como texto aunque venga NULL
            string? Texto(string columna)
            {
                int i = r.GetOrdinal(columna);
                return r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i));
            }

            int iFecha = r.GetOrdinal("FechaNacimiento");

            return new PacientePerfil
            {
                Id = r.GetGuid(r.GetOrdinal("Id")),
                Nombre = Texto("Nombre") ?? string.Empty,
                Apellidos = Texto("Apellidos"),
                Telefono = Texto("Telefono"),
                FechaNacimiento = r.IsDBNull(iFecha) ? null : r.GetDateTime(iFecha),
                Genero = Texto("Genero"),
                FotoUrl = Texto("FotoUrl")
            };
        }
    }
}