/* =====================================================================
   vitaGo - Script de creación de la base de datos y sus tablas
   SQL Server (SSMS: abre este archivo y presiona F5)

   Tablas (en orden de creación por las llaves foráneas):
     1. USUARIO              cuenta de acceso (login con JWT)
     2. PACIENTE             perfil del paciente       -> USUARIO
     3. MEDICO               perfil del médico         -> USUARIO
     4. ESPECIALIDAD         catálogo de especialidades
     5. MEDICO_ESPECIALIDAD  médico <-> especialidad
     6. CONSULTORIO          clínica / dirección       -> MEDICO
     7. HORARIO              días y horas de atención  -> MEDICO, CONSULTORIO
     8. CITA                 citas agendadas           -> PACIENTE, MEDICO, CONSULTORIO
     9. RESENA               calificación de una cita  -> CITA, PACIENTE, MEDICO

   Columnas tomadas de los SP y de la API (MiWebAPI). Después de este
   script se ejecutan los SP y luego:
     SP_Usuarios_Editar_Eliminar.sql, SP_Foto_Paciente.sql,
     SP_Resenas.sql, SP_Medicos_SinVerificacion.sql
   ===================================================================== */

/* ---------- 0. Base de datos ---------- */
IF DB_ID('vitaGo') IS NULL
    CREATE DATABASE vitaGo;
GO
USE vitaGo;
GO

/* =====================================================================
   1. USUARIO
   ===================================================================== */
CREATE TABLE dbo.USUARIO (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_USUARIO_id     DEFAULT NEWID(),
    email           NVARCHAR(254)    NOT NULL,
    password_hash   VARCHAR(255)     NOT NULL,                 -- BCrypt
    rol             VARCHAR(20)      NOT NULL CONSTRAINT DF_USUARIO_rol    DEFAULT 'paciente',
    activo          BIT              NOT NULL CONSTRAINT DF_USUARIO_activo DEFAULT 1,
    fecha_registro  DATETIME2(0)     NOT NULL CONSTRAINT DF_USUARIO_fecha  DEFAULT SYSDATETIME(),

    CONSTRAINT PK_USUARIO       PRIMARY KEY (id),
    CONSTRAINT UQ_USUARIO_email UNIQUE (email),
    CONSTRAINT CK_USUARIO_rol   CHECK (rol IN ('admin', 'medico', 'paciente'))
);
GO

/* =====================================================================
   2. PACIENTE
   ===================================================================== */
CREATE TABLE dbo.PACIENTE (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_PACIENTE_id DEFAULT NEWID(),
    usuario_id       UNIQUEIDENTIFIER NOT NULL,
    nombre           NVARCHAR(80)     NOT NULL,
    apellidos        NVARCHAR(120)    NOT NULL CONSTRAINT DF_PACIENTE_apellidos DEFAULT '',
    telefono         NVARCHAR(20)     NULL,
    fecha_nacimiento DATE             NULL,
    genero           NVARCHAR(20)     NULL,
    foto_url         NVARCHAR(MAX)    NULL,                    -- enlace o imagen en base64

    CONSTRAINT PK_PACIENTE         PRIMARY KEY (id),
    CONSTRAINT UQ_PACIENTE_usuario UNIQUE (usuario_id),
    CONSTRAINT FK_PACIENTE_USUARIO FOREIGN KEY (usuario_id) REFERENCES dbo.USUARIO(id)
);
GO

/* =====================================================================
   3. MEDICO
   ===================================================================== */
CREATE TABLE dbo.MEDICO (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_MEDICO_id DEFAULT NEWID(),
    usuario_id        UNIQUEIDENTIFIER NOT NULL,
    nombre            NVARCHAR(80)     NOT NULL,
    apellidos         NVARCHAR(120)    NOT NULL,
    cedula            NVARCHAR(20)     NOT NULL,               -- cédula profesional
    telefono          NVARCHAR(20)     NULL,
    bio               NVARCHAR(MAX)    NULL,
    anios_experiencia TINYINT          NULL,
    idiomas           NVARCHAR(100)    NULL,                   -- "Español, Inglés"
    precio_consulta   DECIMAL(10,2)    NOT NULL CONSTRAINT DF_MEDICO_precio   DEFAULT 0,
    consulta_online   BIT              NOT NULL CONSTRAINT DF_MEDICO_online   DEFAULT 0,
    foto_url          NVARCHAR(500)    NULL,
    verificado        BIT              NOT NULL CONSTRAINT DF_MEDICO_verif    DEFAULT 0,   -- palomita ✓
    estado_registro   VARCHAR(20)      NOT NULL CONSTRAINT DF_MEDICO_estado   DEFAULT 'pendiente',
    rating_promedio   DECIMAL(3,2)     NULL,                   -- lo recalcula sp_crearResena
    total_resenas     INT              NOT NULL CONSTRAINT DF_MEDICO_resenas  DEFAULT 0,
    num_pacientes     INT              NOT NULL CONSTRAINT DF_MEDICO_pacientes DEFAULT 0,

    CONSTRAINT PK_MEDICO          PRIMARY KEY (id),
    CONSTRAINT UQ_MEDICO_usuario  UNIQUE (usuario_id),
    CONSTRAINT UQ_MEDICO_cedula   UNIQUE (cedula),
    CONSTRAINT FK_MEDICO_USUARIO  FOREIGN KEY (usuario_id) REFERENCES dbo.USUARIO(id),
    CONSTRAINT CK_MEDICO_estado   CHECK (estado_registro IN ('pendiente', 'aprobado', 'rechazado')),
    CONSTRAINT CK_MEDICO_precio   CHECK (precio_consulta >= 0),
    CONSTRAINT CK_MEDICO_anios    CHECK (anios_experiencia BETWEEN 0 AND 80),
    CONSTRAINT CK_MEDICO_rating   CHECK (rating_promedio BETWEEN 0 AND 5)
);
GO

/* =====================================================================
   4. ESPECIALIDAD  (id entero: así lo lee Especialidad.cs)
   ===================================================================== */
CREATE TABLE dbo.ESPECIALIDAD (
    id          INT IDENTITY(1,1) NOT NULL,
    nombre      NVARCHAR(80)      NOT NULL,
    descripcion NVARCHAR(300)     NULL,
    icono       NVARCHAR(100)     NULL,                        -- clase o nombre del ícono del index
    activo      BIT               NOT NULL CONSTRAINT DF_ESPECIALIDAD_activo DEFAULT 1,

    CONSTRAINT PK_ESPECIALIDAD        PRIMARY KEY (id),
    CONSTRAINT UQ_ESPECIALIDAD_nombre UNIQUE (nombre)
);
GO

/* =====================================================================
   5. MEDICO_ESPECIALIDAD
   ===================================================================== */
CREATE TABLE dbo.MEDICO_ESPECIALIDAD (
    medico_id       UNIQUEIDENTIFIER NOT NULL,
    especialidad_id INT              NOT NULL,
    es_principal    BIT              NOT NULL CONSTRAINT DF_MEDESP_principal DEFAULT 1,

    CONSTRAINT PK_MEDICO_ESPECIALIDAD PRIMARY KEY (medico_id, especialidad_id),
    CONSTRAINT FK_MEDESP_MEDICO       FOREIGN KEY (medico_id)       REFERENCES dbo.MEDICO(id),
    CONSTRAINT FK_MEDESP_ESPECIALIDAD FOREIGN KEY (especialidad_id) REFERENCES dbo.ESPECIALIDAD(id)
);
GO

/* =====================================================================
   6. CONSULTORIO
   ===================================================================== */
CREATE TABLE dbo.CONSULTORIO (
    id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CONSULTORIO_id DEFAULT NEWID(),
    medico_id UNIQUEIDENTIFIER NOT NULL,
    nombre    NVARCHAR(120)    NOT NULL,
    direccion NVARCHAR(200)    NOT NULL,
    ciudad    NVARCHAR(80)     NOT NULL,
    estado    NVARCHAR(80)     NULL,                           -- estado de la república
    cp        NVARCHAR(10)     NULL,
    latitud   DECIMAL(9,6)     NULL,
    longitud  DECIMAL(9,6)     NULL,
    activo    BIT              NOT NULL CONSTRAINT DF_CONSULTORIO_activo DEFAULT 1,

    CONSTRAINT PK_CONSULTORIO        PRIMARY KEY (id),
    CONSTRAINT FK_CONSULTORIO_MEDICO FOREIGN KEY (medico_id) REFERENCES dbo.MEDICO(id),
    CONSTRAINT CK_CONSULTORIO_lat    CHECK (latitud  BETWEEN -90  AND 90),
    CONSTRAINT CK_CONSULTORIO_lng    CHECK (longitud BETWEEN -180 AND 180)
);
GO

/* =====================================================================
   7. HORARIO  (un renglón por día; 1 = lunes ... 7 = domingo)
   ===================================================================== */
CREATE TABLE dbo.HORARIO (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_HORARIO_id DEFAULT NEWID(),
    medico_id         UNIQUEIDENTIFIER NOT NULL,
    consultorio_id    UNIQUEIDENTIFIER NULL,                   -- NULL = horario de videoconsulta
    dia_semana        TINYINT          NOT NULL,
    hora_inicio       TIME(0)          NOT NULL,
    hora_fin          TIME(0)          NOT NULL,
    duracion_slot_min SMALLINT         NOT NULL CONSTRAINT DF_HORARIO_slot DEFAULT 30,
    activo            BIT              NOT NULL CONSTRAINT DF_HORARIO_activo DEFAULT 1,

    CONSTRAINT PK_HORARIO             PRIMARY KEY (id),
    CONSTRAINT FK_HORARIO_MEDICO      FOREIGN KEY (medico_id)      REFERENCES dbo.MEDICO(id),
    CONSTRAINT FK_HORARIO_CONSULTORIO FOREIGN KEY (consultorio_id) REFERENCES dbo.CONSULTORIO(id),
    CONSTRAINT CK_HORARIO_dia         CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT CK_HORARIO_horas       CHECK (hora_fin > hora_inicio),
    CONSTRAINT CK_HORARIO_slot        CHECK (duracion_slot_min BETWEEN 10 AND 240)
);
GO

/* =====================================================================
   8. CITA
      folio: VG-1, VG-2 ... sale de un número consecutivo.
   ===================================================================== */
CREATE TABLE dbo.CITA (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CITA_id DEFAULT NEWID(),
    numero         INT IDENTITY(1,1) NOT NULL,
    folio          AS ('VG-' + CAST(numero AS VARCHAR(10))) PERSISTED,
    paciente_id    UNIQUEIDENTIFIER NOT NULL,
    medico_id      UNIQUEIDENTIFIER NOT NULL,
    consultorio_id UNIQUEIDENTIFIER NULL,                      -- NULL si es videoconsulta
    fecha_hora     DATETIME2(0)     NOT NULL,
    duracion_min   SMALLINT         NOT NULL CONSTRAINT DF_CITA_duracion DEFAULT 30,
    modalidad      VARCHAR(12)      NOT NULL CONSTRAINT DF_CITA_modalidad DEFAULT 'presencial',
    motivo         NVARCHAR(1000)   NULL,
    estado         VARCHAR(20)      NOT NULL CONSTRAINT DF_CITA_estado   DEFAULT 'confirmada',
    costo          DECIMAL(10,2)    NOT NULL CONSTRAINT DF_CITA_costo    DEFAULT 0,  -- precio al momento de agendar
    moneda         CHAR(3)          NOT NULL CONSTRAINT DF_CITA_moneda   DEFAULT 'MXN',
    fecha_creacion DATETIME2(0)     NOT NULL CONSTRAINT DF_CITA_creacion DEFAULT SYSDATETIME(),

    CONSTRAINT PK_CITA             PRIMARY KEY (id),
    CONSTRAINT UQ_CITA_numero      UNIQUE (numero),
    CONSTRAINT FK_CITA_PACIENTE    FOREIGN KEY (paciente_id)    REFERENCES dbo.PACIENTE(id),
    CONSTRAINT FK_CITA_MEDICO      FOREIGN KEY (medico_id)      REFERENCES dbo.MEDICO(id),
    CONSTRAINT FK_CITA_CONSULTORIO FOREIGN KEY (consultorio_id) REFERENCES dbo.CONSULTORIO(id),
    CONSTRAINT CK_CITA_modalidad   CHECK (modalidad IN ('presencial', 'video')),
    CONSTRAINT CK_CITA_estado      CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    CONSTRAINT CK_CITA_costo       CHECK (costo >= 0)
);
GO

-- Un médico no puede tener dos citas activas a la misma hora
CREATE UNIQUE INDEX UX_CITA_medico_hora
    ON dbo.CITA (medico_id, fecha_hora)
    WHERE estado <> 'cancelada';
GO
CREATE INDEX IX_CITA_paciente ON dbo.CITA (paciente_id, fecha_hora);
GO

/* =====================================================================
   9. RESENA  (una reseña por cita, de 1 a 5 estrellas)
   ===================================================================== */
CREATE TABLE dbo.RESENA (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RESENA_id    DEFAULT NEWID(),
    cita_id      UNIQUEIDENTIFIER NOT NULL,
    paciente_id  UNIQUEIDENTIFIER NOT NULL,
    medico_id    UNIQUEIDENTIFIER NOT NULL,
    calificacion TINYINT          NOT NULL,
    comentario   NVARCHAR(1000)   NULL,
    fecha        DATETIME2(0)     NOT NULL CONSTRAINT DF_RESENA_fecha DEFAULT SYSDATETIME(),

    CONSTRAINT PK_RESENA          PRIMARY KEY (id),
    CONSTRAINT UQ_RESENA_cita     UNIQUE (cita_id),
    CONSTRAINT FK_RESENA_CITA     FOREIGN KEY (cita_id)     REFERENCES dbo.CITA(id),
    CONSTRAINT FK_RESENA_PACIENTE FOREIGN KEY (paciente_id) REFERENCES dbo.PACIENTE(id),
    CONSTRAINT FK_RESENA_MEDICO   FOREIGN KEY (medico_id)   REFERENCES dbo.MEDICO(id),
    CONSTRAINT CK_RESENA_calif    CHECK (calificacion BETWEEN 1 AND 5)
);
GO
CREATE INDEX IX_RESENA_medico ON dbo.RESENA (medico_id, fecha DESC);
GO

/* =====================================================================
   10. Datos iniciales: especialidades
   ===================================================================== */
INSERT INTO dbo.ESPECIALIDAD (nombre, descripcion, icono) VALUES
    (N'Medicina General', N'Consulta general y chequeos de rutina',      'bi-heart-pulse'),
    (N'Pediatría',        N'Atención médica para niños y adolescentes',  'bi-emoji-smile'),
    (N'Cardiología',      N'Corazón y sistema circulatorio',              'bi-heart'),
    (N'Dermatología',     N'Piel, cabello y uñas',                        'bi-droplet'),
    (N'Ginecología',      N'Salud de la mujer',                           'bi-gender-female'),
    (N'Psicología',       N'Salud mental y emocional',                    'bi-chat-heart'),
    (N'Odontología',      N'Salud bucal y dental',                        'bi-emoji-laughing'),
    (N'Oftalmología',     N'Ojos y visión',                               'bi-eye'),
    (N'Traumatología',    N'Huesos, músculos y articulaciones',           'bi-bandaid'),
    (N'Nutrición',        N'Alimentación y control de peso',              'bi-apple');
GO

/* ---------------------------------------------------------------------
   PRUEBA: deben salir las 9 tablas
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME;
--------------------------------------------------------------------- */
