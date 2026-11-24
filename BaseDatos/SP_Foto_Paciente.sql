/* =====================================================================
   vitaGo - Foto de perfil del paciente subida desde el dispositivo
   Ejecutar en la base vitaGo (SSMS: abre este archivo y presiona F5).

   La página recorta la foto a 300x300 y la manda como texto
   (data:image/jpeg;base64,...), de unos 20-40 KB. No cabe en
   NVARCHAR(500), así que la columna pasa a NVARCHAR(MAX).
   Ventaja: la foto vive en la base, así que no se pierde cuando
   se vuelve a publicar la API en Azure.
   ===================================================================== */

/* ---------- 1. Columna más grande ---------- */
ALTER TABLE dbo.PACIENTE ALTER COLUMN foto_url NVARCHAR(MAX) NULL;
GO

/* ---------- 2. sp_editarPaciente acepta la foto completa ----------
   (Mismo SP de SP_Usuarios_Editar_Eliminar.sql, solo cambia @FotoUrl a MAX) */
CREATE OR ALTER PROCEDURE sp_editarPaciente
    @PacienteId      UNIQUEIDENTIFIER,
    @Nombre          NVARCHAR(80),
    @Apellidos       NVARCHAR(120),
    @Telefono        NVARCHAR(20)  = NULL,
    @FechaNacimiento DATE          = NULL,
    @Genero          NVARCHAR(20)  = NULL,
    @FotoUrl         NVARCHAR(MAX) = NULL,
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
