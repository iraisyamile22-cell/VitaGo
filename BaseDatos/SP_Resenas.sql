/* =====================================================================
   vitaGo - Reseñas de pacientes a médicos
   Ejecutar en la base vitaGo DESPUÉS del paso 0.

   Crea:
     sp_crearResena     -> POST api/citas/{id}/resena
     sp_citasResenadas  -> GET  api/citas/resenadas

   Reglas:
     - Solo puede calificar el paciente dueño de la cita.
     - La cita ya debe haber pasado y no estar cancelada.
     - Una reseña por cita.
     - Al guardar, se recalculan MEDICO.rating_promedio y total_resenas
       (son los que se muestran en las tarjetas y en el perfil).
   ===================================================================== */

/* ---------------------------------------------------------------------
   0. VERIFICACIÓN — EJECUTA SOLO ESTO PRIMERO (selecciónalo y F5).
      Los nombres de la tabla de reseñas los supuse, porque no tengo su
      estructura. Este script espera:
          RESENA: cita_id, paciente_id, medico_id, calificacion, comentario, fecha
      Si en el resultado las columnas se llaman distinto (por ejemplo
      "rating" en vez de "calificacion"), NO ejecutes el resto:
      mándame el resultado y lo ajusto.
   --------------------------------------------------------------------- */
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME LIKE '%RESE%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

/* =====================================================================
   1. sp_crearResena
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_crearResena
    @IdCita       UNIQUEIDENTIFIER,
    @PacienteId   UNIQUEIDENTIFIER,
    @Calificacion TINYINT,
    @Comentario   NVARCHAR(1000) = NULL,
    @numeroError  INT OUTPUT,
    @respuesta    VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MedicoId UNIQUEIDENTIFIER, @FechaHora DATETIME2, @Estado VARCHAR(20);

    SELECT @MedicoId = medico_id, @FechaHora = fecha_hora, @Estado = estado
    FROM dbo.CITA
    WHERE id = @IdCita AND paciente_id = @PacienteId;

    IF @MedicoId IS NULL
    BEGIN SET @numeroError = 1; SET @respuesta = 'La cita no existe'; RETURN; END
    IF @Estado = 'cancelada'
    BEGIN SET @numeroError = 2; SET @respuesta = 'No puedes calificar una cita cancelada'; RETURN; END
    IF @FechaHora > GETDATE()
    BEGIN SET @numeroError = 3; SET @respuesta = 'Podrás calificar al médico después de tu cita'; RETURN; END
    IF EXISTS (SELECT 1 FROM dbo.RESENA WHERE cita_id = @IdCita)
    BEGIN SET @numeroError = 4; SET @respuesta = 'Ya calificaste esta cita'; RETURN; END
    IF @Calificacion NOT BETWEEN 1 AND 5
    BEGIN SET @numeroError = 5; SET @respuesta = 'La calificación va de 1 a 5 estrellas'; RETURN; END

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO dbo.RESENA (cita_id, paciente_id, medico_id, calificacion, comentario, fecha)
        VALUES (@IdCita, @PacienteId, @MedicoId, @Calificacion,
                NULLIF(LTRIM(RTRIM(@Comentario)), ''), SYSDATETIME());

        -- Promedio y total que se muestran en tarjetas y perfil
        UPDATE m
        SET rating_promedio = r.promedio,
            total_resenas   = r.total
        FROM dbo.MEDICO m
        CROSS APPLY (SELECT CAST(AVG(CAST(calificacion AS DECIMAL(4,2))) AS DECIMAL(3,2)) AS promedio,
                            COUNT(*) AS total
                     FROM dbo.RESENA
                     WHERE medico_id = @MedicoId) r
        WHERE m.id = @MedicoId;

        COMMIT TRAN;
        SET @numeroError = 0;
        SET @respuesta = '¡Gracias! Tu reseña quedó publicada';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = LEFT(ERROR_MESSAGE(), 1000);
    END CATCH
END
GO

/* =====================================================================
   2. sp_citasResenadas  (para no ofrecer "Calificar" dos veces)
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_citasResenadas
    @PacienteId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    SELECT cita_id
    FROM dbo.RESENA
    WHERE paciente_id = @PacienteId;
END
GO
