/* =====================================================================
   vitaGo - Verificación de correo al registrarse
   Ejecutar en la base vitaGo (SSMS: abre este archivo y presiona F5).
   Se puede ejecutar más de una vez sin problema.

   Qué hace:
     1. Agrega a USUARIO: email_verificado, token_verificacion,
        token_expira y token_creado.
        · Las cuentas que YA existen quedan verificadas (nadie se queda fuera).
        · Las cuentas NUEVAS empiezan sin verificar.
     2. Crea los SP:
        sp_generarTokenVerificacion -> registro y "Reenviar correo"
        sp_verificarCorreo          -> verificar.html (POST api/auth/verificar)
        sp_estadoVerificacion       -> login (no deja entrar sin verificar)

   En la base solo se guarda el HASH (SHA-256) del token, no el token.
   ===================================================================== */

/* ---------- 1. Columnas nuevas ---------- */
IF COL_LENGTH('dbo.USUARIO', 'email_verificado') IS NULL
    ALTER TABLE dbo.USUARIO
        ADD email_verificado BIT NOT NULL
            CONSTRAINT DF_USUARIO_email_verificado DEFAULT 1 WITH VALUES;   -- las cuentas actuales = verificadas
GO
IF COL_LENGTH('dbo.USUARIO', 'token_verificacion') IS NULL
    ALTER TABLE dbo.USUARIO ADD token_verificacion CHAR(64) NULL;
IF COL_LENGTH('dbo.USUARIO', 'token_expira') IS NULL
    ALTER TABLE dbo.USUARIO ADD token_expira DATETIME2 NULL;
IF COL_LENGTH('dbo.USUARIO', 'token_creado') IS NULL
    ALTER TABLE dbo.USUARIO ADD token_creado DATETIME2 NULL;
GO

-- A partir de ahora, las cuentas nuevas empiezan SIN verificar (default 0)
IF EXISTS (SELECT 1 FROM sys.default_constraints
           WHERE name = 'DF_USUARIO_email_verificado' AND definition = '((1))')
BEGIN
    ALTER TABLE dbo.USUARIO DROP CONSTRAINT DF_USUARIO_email_verificado;
    ALTER TABLE dbo.USUARIO ADD CONSTRAINT DF_USUARIO_email_verificado DEFAULT 0 FOR email_verificado;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_USUARIO_token_verificacion')
    CREATE INDEX IX_USUARIO_token_verificacion
        ON dbo.USUARIO (token_verificacion)
        WHERE token_verificacion IS NOT NULL;
GO

/* =====================================================================
   2. sp_generarTokenVerificacion
      Errores: 1 = la cuenta no existe, 2 = ya está verificada,
               3 = se pidió otro correo hace menos de 1 minuto
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_generarTokenVerificacion
    @Correo      NVARCHAR(254),
    @TokenHash   CHAR(64),
    @ExpiraUtc   DATETIME2,
    @Nombre      NVARCHAR(80)  OUTPUT,
    @numeroError INT           OUTPUT,
    @respuesta   VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UsuarioId UNIQUEIDENTIFIER, @Verificado BIT, @Creado DATETIME2;

    SELECT @UsuarioId = id, @Verificado = email_verificado, @Creado = token_creado
    FROM dbo.USUARIO
    WHERE email = @Correo AND activo = 1;

    IF @UsuarioId IS NULL
    BEGIN SET @numeroError = 1; SET @respuesta = 'La cuenta no existe'; RETURN; END
    IF @Verificado = 1
    BEGIN SET @numeroError = 2; SET @respuesta = 'La cuenta ya está verificada'; RETURN; END
    IF @Creado IS NOT NULL AND @Creado > DATEADD(SECOND, -60, SYSUTCDATETIME())
    BEGIN SET @numeroError = 3; SET @respuesta = 'Ya te enviamos un correo hace un momento. Espera un minuto para pedir otro.'; RETURN; END

    UPDATE dbo.USUARIO
    SET token_verificacion = @TokenHash,
        token_expira       = @ExpiraUtc,
        token_creado       = SYSUTCDATETIME()
    WHERE id = @UsuarioId;

    -- Nombre para saludar en el correo (paciente o médico)
    SELECT @Nombre = COALESCE(
        (SELECT TOP 1 nombre FROM dbo.PACIENTE WHERE usuario_id = @UsuarioId),
        (SELECT TOP 1 nombre FROM dbo.MEDICO   WHERE usuario_id = @UsuarioId));

    SET @numeroError = 0;
    SET @respuesta = 'Token generado';
END
GO

/* =====================================================================
   3. sp_verificarCorreo
      Errores: 1 = enlace no válido o ya usado, 2 = enlace vencido
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_verificarCorreo
    @TokenHash   CHAR(64),
    @numeroError INT           OUTPUT,
    @respuesta   VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UsuarioId UNIQUEIDENTIFIER, @Expira DATETIME2;

    SELECT @UsuarioId = id, @Expira = token_expira
    FROM dbo.USUARIO
    WHERE token_verificacion = @TokenHash AND activo = 1;

    IF @UsuarioId IS NULL
    BEGIN SET @numeroError = 1; SET @respuesta = 'El enlace no es válido o ya se usó'; RETURN; END
    IF @Expira < SYSUTCDATETIME()
    BEGIN SET @numeroError = 2; SET @respuesta = 'El enlace venció. Pide uno nuevo.'; RETURN; END

    UPDATE dbo.USUARIO
    SET email_verificado   = 1,
        token_verificacion = NULL,
        token_expira       = NULL
    WHERE id = @UsuarioId;

    SET @numeroError = 0;
    SET @respuesta = '¡Tu correo quedó verificado! Ya puedes iniciar sesión.';
END
GO

/* =====================================================================
   4. sp_estadoVerificacion  (lo usa el login)
   ===================================================================== */
CREATE OR ALTER PROCEDURE sp_estadoVerificacion
    @UsuarioId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT email_verificado FROM dbo.USUARIO WHERE id = @UsuarioId;
END
GO

/* ---------------------------------------------------------------------
   ÚTIL PARA PRUEBAS

   -- Ver el estado de las cuentas:
   SELECT email, rol, email_verificado, token_expira FROM dbo.USUARIO ORDER BY email;

   -- Verificar una cuenta a mano (por ejemplo, un admin que crearon con SQL):
   UPDATE dbo.USUARIO SET email_verificado = 1 WHERE email = 'correo@ejemplo.com';
--------------------------------------------------------------------- */
