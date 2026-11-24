/* =====================================================================
   vitaGo - Stored procedures de EDITAR y ELIMINAR usuarios
   Ejecutar en la base vitaGo (SSMS: abre este archivo y presiona F5).

   Crea / actualiza:
     1. sp_editarPaciente   -> PUT    api/Pacientes/perfil
     2. sp_cambiarPassword  -> POST   api/Auth/cambiar-password
     3. sp_eliminarUsuario  -> DELETE api/Auth/cuenta   (cualquier rol)
     4. sp_eliminarDoctor   -> DELETE api/Doctores/{id} (admin)
     5. sp_editarDoctor     -> PUT    api/Doctores/{id} (admin o el mismo médico)

   Todos regresan @numeroError (0 = OK) y @respuesta, igual que los demás SP.
   ===================================================================== */

/* ---------------------------------------------------------------------
   0. VERIFICACIÓN (opcional). Ejecuta solo este SELECT primero.
      Si alguna columna de abajo NO aparece en el resultado, avísame
      antes de crear los SP, porque los nombres de columnas se tomaron
      de los SP que ya existen (sp_perfilPaciente, sp_listarDoctores...).
        USUARIO : id, email, password_hash, activo
        PACIENTE: id, usuario_id, nombre, apellidos, telefono,
                  fecha_nacimiento, genero, foto_url
        MEDICO  : id, usuario_id, nombre, apellidos, cedula, telefono,
                  bio, anios_experiencia, idiomas, precio_consulta,
                  consulta_online, foto_url
        CITA    : paciente_id, medico_id, fecha_hora, estado
   --------------------------------------------------------------------- */
-- SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME IN ('USUARIO', 'PACIENTE', 'MEDICO', 'CITA')
-- ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

/* =====================================================================
   1. sp_editarPaciente
      El paciente edita sus datos personales. El correo NO se cambia aquí
      (es el usuario de inicio de sesión).
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_editarPaciente
    @PacienteId      UNIQUEIDENTIFIER,
    @Nombre          NVARCHAR(80),
    @Apellidos       NVARCHAR(120),
    @Telefono        NVARCHAR(20)  = NULL,
    @FechaNacimiento DATE          = NULL,
    @Genero          NVARCHAR(20)  = NULL,
    @FotoUrl         NVARCHAR(MAX) = NULL,  -- enlace o imagen en base64 (ver SP_Foto_Paciente.sql)
    @numeroError     INT OUTPUT,
    @respuesta       VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM PACIENTE WHERE id = @PacienteId)
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El paciente no existe';
            RETURN;
        END

        IF LTRIM(RTRIM(ISNULL(@Nombre, ''))) = ''
        BEGIN
            SET @numeroError = 2;
            SET @respuesta = 'El nombre es obligatorio';
            RETURN;
        END

        IF @FechaNacimiento IS NOT NULL AND @FechaNacimiento > CAST(GETDATE() AS DATE)
        BEGIN
            SET @numeroError = 3;
            SET @respuesta = 'La fecha de nacimiento no puede ser futura';
            RETURN;
        END

        UPDATE PACIENTE
        SET nombre           = LTRIM(RTRIM(@Nombre)),
            apellidos        = LTRIM(RTRIM(ISNULL(@Apellidos, ''))),
            telefono         = NULLIF(LTRIM(RTRIM(@Telefono)), ''),
            fecha_nacimiento = @FechaNacimiento,
            genero           = NULLIF(LTRIM(RTRIM(@Genero)), ''),
            foto_url         = NULLIF(LTRIM(RTRIM(@FotoUrl)), '')
        WHERE id = @PacienteId;

        SET @numeroError = 0;
        SET @respuesta = 'Perfil actualizado correctamente';
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO

/* =====================================================================
   2. sp_cambiarPassword
      La API verifica la contraseña actual con BCrypt y manda el hash nuevo.
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_cambiarPassword
    @UsuarioId    UNIQUEIDENTIFIER,
    @PasswordHash VARCHAR(255),
    @numeroError  INT OUTPUT,
    @respuesta    VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id = @UsuarioId AND activo = 1)
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El usuario no existe';
            RETURN;
        END

        UPDATE USUARIO
        SET password_hash = @PasswordHash
        WHERE id = @UsuarioId;

        SET @numeroError = 0;
        SET @respuesta = 'Contraseña actualizada correctamente';
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO

/* =====================================================================
   3. sp_eliminarUsuario  (baja lógica, sirve para paciente y médico)
      - Cancela sus citas futuras.
      - Desactiva la cuenta (activo = 0) y libera el correo, cambiándolo por
        uno interno; así ya no puede iniciar sesión y el correo se puede
        volver a registrar.
      - Borra los datos personales del perfil, pero conserva el registro para
        no romper el historial de citas (llaves foráneas).
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_eliminarUsuario
    @UsuarioId   UNIQUEIDENTIFIER,
    @numeroError INT OUTPUT,
    @respuesta   VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id = @UsuarioId AND activo = 1)
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'La cuenta no existe o ya fue eliminada';
            RETURN;
        END

        BEGIN TRANSACTION;

        DECLARE @PacienteId UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM PACIENTE WHERE usuario_id = @UsuarioId);
        DECLARE @MedicoId   UNIQUEIDENTIFIER = (SELECT TOP 1 id FROM MEDICO   WHERE usuario_id = @UsuarioId);

        -- Citas pendientes a futuro: se cancelan (como paciente o como médico)
        UPDATE CITA
        SET estado = 'cancelada'
        WHERE fecha_hora > GETDATE()
          AND estado NOT IN ('cancelada', 'completada')
          AND (paciente_id = @PacienteId OR medico_id = @MedicoId);

        -- Datos personales del paciente
        IF @PacienteId IS NOT NULL
            UPDATE PACIENTE
            SET nombre           = 'Usuario',
                apellidos        = 'eliminado',
                telefono         = NULL,
                fecha_nacimiento = NULL,
                genero           = NULL,
                foto_url         = NULL
            WHERE id = @PacienteId;

        -- Datos de contacto del médico
        IF @MedicoId IS NOT NULL
            UPDATE MEDICO
            SET telefono = NULL,
                foto_url = NULL
            WHERE id = @MedicoId;

        -- Cuenta: desactivada y con el correo liberado
        UPDATE USUARIO
        SET activo = 0,
            email  = CONCAT('eliminado_', REPLACE(CONVERT(VARCHAR(36), id), '-', ''), '@vitago.local')
        WHERE id = @UsuarioId;

        COMMIT TRANSACTION;

        SET @numeroError = 0;
        SET @respuesta = 'Cuenta eliminada correctamente';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO

/* =====================================================================
   4. sp_eliminarDoctor  (lo usa el admin desde doctores.html)
      Busca el usuario del médico y reutiliza sp_eliminarUsuario.
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_eliminarDoctor
    @IdDoctor    UNIQUEIDENTIFIER,
    @numeroError INT OUTPUT,
    @respuesta   VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UsuarioId UNIQUEIDENTIFIER = (SELECT usuario_id FROM MEDICO WHERE id = @IdDoctor);

    IF @UsuarioId IS NULL
    BEGIN
        SET @numeroError = 1;
        SET @respuesta = 'El doctor no existe';
        RETURN;
    END

    EXEC sp_eliminarUsuario @UsuarioId, @numeroError OUTPUT, @respuesta OUTPUT;

    IF @numeroError = 0 SET @respuesta = 'Doctor eliminado correctamente';
END
GO

/* =====================================================================
   5. sp_editarDoctor
      Edita los datos del médico y su correo (que vive en USUARIO).
      La especialidad no se cambia aquí: vive en otra tabla y se queda igual.
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_editarDoctor
    @IdDoctor         UNIQUEIDENTIFIER,
    @Nombre           NVARCHAR(80),
    @Apellidos        NVARCHAR(120),
    @Cedula           NVARCHAR(20),
    @Correo           NVARCHAR(254),
    @Telefono         NVARCHAR(20)  = NULL,
    @PrecioConsulta   DECIMAL(10,2),
    @Bio              NVARCHAR(MAX) = NULL,
    @AniosExperiencia INT           = NULL,
    @Idiomas          NVARCHAR(100) = NULL,
    @ConsultaOnline   BIT           = 0,
    @numeroError      INT OUTPUT,
    @respuesta        VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @UsuarioId UNIQUEIDENTIFIER = (SELECT usuario_id FROM MEDICO WHERE id = @IdDoctor);

        IF @UsuarioId IS NULL
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El doctor no existe';
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM USUARIO WHERE email = LTRIM(RTRIM(@Correo)) AND id <> @UsuarioId)
        BEGIN
            SET @numeroError = 2;
            SET @respuesta = 'Ese correo ya está registrado con otra cuenta';
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM MEDICO WHERE cedula = LTRIM(RTRIM(@Cedula)) AND id <> @IdDoctor)
        BEGIN
            SET @numeroError = 3;
            SET @respuesta = 'Esa cédula ya está registrada con otro médico';
            RETURN;
        END

        BEGIN TRANSACTION;

        UPDATE MEDICO
        SET nombre            = LTRIM(RTRIM(@Nombre)),
            apellidos         = LTRIM(RTRIM(@Apellidos)),
            cedula            = LTRIM(RTRIM(@Cedula)),
            telefono          = NULLIF(LTRIM(RTRIM(@Telefono)), ''),
            precio_consulta   = @PrecioConsulta,
            bio               = NULLIF(LTRIM(RTRIM(@Bio)), ''),
            anios_experiencia = ISNULL(@AniosExperiencia, anios_experiencia),
            idiomas           = NULLIF(LTRIM(RTRIM(@Idiomas)), ''),
            consulta_online   = ISNULL(@ConsultaOnline, consulta_online)
        WHERE id = @IdDoctor;

        UPDATE USUARIO
        SET email = LTRIM(RTRIM(@Correo))
        WHERE id = @UsuarioId;

        COMMIT TRANSACTION;

        SET @numeroError = 0;
        SET @respuesta = 'Doctor actualizado correctamente';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO

/* ---------------------------------------------------------------------
   PRUEBAS RÁPIDAS (cambia los GUID por unos reales de tu base)
   ---------------------------------------------------------------------
DECLARE @n INT, @r VARCHAR(1000);

EXEC sp_editarPaciente '70DE73B3-6F25-47C7-8EAF-68BFD4C1CA88',
     'Alex', 'Díaz', '7731234567', '2000-05-10', 'hombre', NULL, @n OUTPUT, @r OUTPUT;
SELECT @n AS numeroError, @r AS respuesta;

-- ¡Ojo! Esta sí desactiva la cuenta:
-- EXEC sp_eliminarUsuario '<USUARIO.id>', @n OUTPUT, @r OUTPUT;
-- SELECT @n, @r;
--------------------------------------------------------------------- */
