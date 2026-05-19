# 📋 Plan de Implementación: Mantenimiento de Choferes (driver_info)

Para cumplir con el estándar de arquitectura definido en `D:\Personal\Skill\skill-backend.md`, crearemos el CRUD completo de choferes. Dado que un chofer **es un usuario** en el sistema con el rol `DRIVER`, la forma más limpia y robusta es integrar la gestión de `driver_info` directamente en las operaciones de usuarios cuando el rol es `DRIVER`, o crear un conjunto de comandos/queries específicos para Choferes. 

Proponemos la **Opción Integrada**, que reutiliza la seguridad y creación de usuarios vinculando los datos de conducción fluidamente.

---

## 🛠️ Modificaciones en el Backend (`GpsApiCentral`)

### 1. Actualizar el Repositorio de Usuarios
Modificaremos [TypeOrmUserRepository](file:///d:/Personal/Repositorios/GpsApiCentral/src/user/infrastructure/persistence/typeorm-user.repository.ts) para que haga un join con la relación `driverInfo` en los métodos de búsqueda:
* `findById`
* `findByEmail`
* `findByTenantId`

### 2. Modificar el Comando y DTO de Creación (`create-user`)
* **DTO:** Agregar campos opcionales para chofer (`licenseNumber`, `licenseExpiry`, `dni`, `phoneEmergency`).
* **Command:** Incluir las propiedades de chofer como opcionales.
* **Handler:** Si el rol del nuevo usuario es `DRIVER`:
  1. Validar que vengan los campos requeridos de licencia (`licenseNumber`, `licenseExpiry`, `dni`).
  2. Verificar que el DNI o Licencia no estén duplicados en `driver_info`.
  3. Tras guardar el `UserEntity`, instanciar y guardar un `DriverInfoEntity` asociado al ID del usuario recién creado dentro de la misma transacción de base de datos.

### 3. Modificar el Comando y DTO de Actualización (`update-user`)
* **DTO/Command:** Permitir actualizar de forma opcional los campos de licencia y teléfono de emergencia.
* **Handler:** Si el rol es `DRIVER`:
  1. Buscar si ya existe el registro en `DriverInfoEntity` para ese `userId`.
  2. Si existe, actualizar sus propiedades (`licenseNumber`, `licenseExpiry`, `dni`, `phoneEmergency`).
  3. Si no existe (caso de un usuario que se promueve a chofer), crearlo desde cero.
  4. Guardar los cambios.

### 4. Modificar el Controlador / Rutas HTTP
Asegurar que los controladores de creación y actualización de usuarios devuelvan las respuestas DTO correspondientes incluyendo el objeto `driverInfo` mapeado.

---

## 🚀 Implementación en el Frontend (`GpsCentral`)

Una vez tengamos el backend listo, implementaremos la gestión en el frontend en dos fases:
1. **Extendiendo el formulario de usuarios:** En [UserForm.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/admin/users/components/UserForm.tsx), si el rol seleccionado es `DRIVER`, desplegaremos dinámicamente una sección de **"Datos de Conductor"** que contenga los campos de DNI, Licencia y Teléfono de Emergencia.
2. **Creando la vista dedicada `/admin/drivers`:** Un panel que consuma el endpoint de usuarios filtrando por rol `DRIVER` para mostrar un listado enfocado en las licencias, vencimientos y estados operativos del chofer.

---

## 🚦 ¿Cómo deseas proceder?
* **Opción A (Recomendada):** Implementamos la integración de `driver_info` en los comandos de usuarios actuales (`create-user` y `update-user`). Esto simplifica el mantenimiento y evita duplicar lógica de cuentas (email, password, etc.).
* **Opción B:** Creamos un sub-módulo completamente independiente de `drivers` con sus propios controladores, comandos (`CreateDriverCommand`, `UpdateDriverCommand`) y queries aisladas de la entidad usuarios.
