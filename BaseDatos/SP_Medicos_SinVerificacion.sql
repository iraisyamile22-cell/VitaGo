/* =====================================================================
   vitaGo - Médicos visibles sin verificación de un administrador
   Ejecutar en la base vitaGo (SSMS: abre este archivo y presiona F5).

   ¿Por qué no aparecían?
     sp_buscarMedicos (y el perfil público) solo muestran médicos con
     MEDICO.estado_registro = 'aprobado', pero sp_crearDoctor los guarda
     como 'pendiente' y no existe ninguna pantalla para aprobarlos.

   Qué hace este script:
     1. Aprueba a los médicos que ya están registrados y siguen pendientes.
     2. Crea el trigger trg_MEDICO_AutoAprobar: cada médico nuevo queda
        'aprobado' en cuanto se inserta, sin tocar sp_crearDoctor.
   La columna "verificado" (la palomita ✓ de la tarjeta) NO se toca:
   el médico aparece en el catálogo aunque no tenga la palomita.
   ===================================================================== */

/* ---------- 1. Aprobar a los médicos que ya existen ---------- */
UPDATE MEDICO
SET estado_registro = 'aprobado'
WHERE estado_registro = 'pendiente';

SELECT @@ROWCOUNT AS medicos_aprobados;
GO

/* ---------- 2. Los médicos nuevos se aprueban solos ---------- */
CREATE OR ALTER TRIGGER trg_MEDICO_AutoAprobar
ON MEDICO
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE m
    SET estado_registro = 'aprobado'
    FROM MEDICO m
    JOIN inserted i ON i.id = m.id
    WHERE m.estado_registro = 'pendiente';
END
GO

/* ---------------------------------------------------------------------
   PRUEBA: después de registrar un médico desde registro-medico.html,
   debe salir 'aprobado' y aparecer en el buscador del inicio.

SELECT TOP 5 nombre, apellidos, estado_registro
FROM MEDICO
ORDER BY nombre;

EXEC sp_buscarMedicos @Especialidad = NULL, @Ciudad = NULL, @SoloVideo = 0;
   ---------------------------------------------------------------------

   SI ALGÚN DÍA QUIEREN VOLVER A PEDIR VERIFICACIÓN:
   DROP TRIGGER trg_MEDICO_AutoAprobar;
--------------------------------------------------------------------- */
