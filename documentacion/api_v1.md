# Documentación de API GpsApiCentral v1

Esta documentación es el reflejo exacto de los endpoints disponibles en Swagger, detallando los Request y Response para cada operación.

## 1. Información de Conexión

- **Base URL**: `http://localhost:3000/api`
- **Prefijo Global**: `/api`
- **Versión**: `/v1`
- **Documentación Swagger UI**: `http://localhost:3000/docs`

---

## 2. Autenticación y Usuarios (Auth & Users)

### 2.1. Iniciar Sesión (Login)
- **URL**: `POST /v1/auth/login`
- **Auth**: Pública
- **Request Body**:
```json
{
  "email": "admin@miflota.com",
  "password": "tu_password"
}
```
- **Response (200)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "name": "Juan Perez",
      "email": "juan@empresa.com",
      "role": "ADMIN",
      "tenantId": "uuid"
    }
  }
}
```

### 2.2. Crear Usuario
- **URL**: `POST /v1/users/create`
- **Auth**: Requerida (Bearer)
- **Request Body**:
```json
{
  "tenantId": "uuid",
  "name": "Pedro Picapiedra",
  "email": "pedro@empresa.com",
  "password": "password123",
  "role": "DRIVER"
}
```
- **Response (201)**: Retorna el objeto `User` creado.

### 2.3. Cambiar Contraseña (Usuario Propio)
- **URL**: `POST /v1/user/change-password/:id`
- **Request Body**: `{ "currentPassword": "...", "newPassword": "..." }`

### 2.4. Reiniciar Contraseña (Admin)
- **URL**: `POST /v1/user/reset-password/:id`
- **Request Body**: `{ "newPassword": "..." }`

---

## 3. Empresas (Tenants) - CRUD Completo

### 3.1. Crear Empresa
- **URL**: `POST /v1/tenants/create`
- **Request Body**:
```json
{
  "name": "Empresa SAC",
  "subdomain": "demo",
  "isActive": true,
  "logoUrl": "https://...",
  "primaryColor": "#3f51b5",
  "accentColor": "#ff4081",
  "statusDotColor": "#4caf50",
  "address": "Calle 123",
  "phone": "+51999888777",
  "taxId": "20123456789"
}
```
- **Response (201)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Empresa SAC",
    "subdomain": "demo",
    "isActive": true,
    "logoUrl": "...",
    "primaryColor": "...",
    "accentColor": "...",
    "statusDotColor": "...",
    "createdAt": "2024-05-11T..."
  }
}
```

### 3.2. Listar / Obtener Empresa
- **Listar Todas**: `GET /v1/tenant`
- **Obtener por ID**: `GET /v1/tenant/:id`

### 3.3. Actualizar Empresa
- **URL**: `PUT /v1/tenants/:id`
- **Request Body**: Permite envío de cualquier campo del Tenant para actualización.

---

## 4. Vehículos (Vehicles)

### 4.1. Registrar Vehículo
- **URL**: `POST /v1/vehicles/create`
- **Request Body**:
```json
{
  "plate": "ABC-123",
  "traccarDeviceId": 101,
  "brand": "Toyota",
  "model": "Hilux",
  "year": 2023,
  "tenantId": "uuid",
  "color": "Blanco"
}
```

### 4.2. Listar Vehículos
- **URL**: `GET /v1/vehicle/list?tenantId=<uuid>`

### 4.3. Actualizar Estado
- **URL**: `PATCH /v1/vehicles/:id/status`
- **Request Body**: `{ "status": "OPERATIVO" | "MANTENIMIENTO" | "BAJA" }`

---

## 5. Puntos de Control y Geocercas (Geofences)

### 5.1. Crear Geocerca
- **URL**: `POST /v1/geofences/create`
- **Request Body**:
```json
{
  "traccarGeofenceId": 12,
  "name": "Paradero Sur",
  "type": "START"
}
```
*Tipos: START, CHECKPOINT, END.*

---

## 6. Rutas y Paraderos (Routes & Stops)

### 6.1. Crear Ruta
- **URL**: `POST /v1/routes/create`
- **Request Body**: `{ "name": "Línea 10 - Sur" }`

### 6.2. Actualizar Paraderos (Stops)
- **URL**: `PUT /v1/route/:id/stops`
- **Request Body**:
```json
{
  "stops": [
    { "geofenceId": "uuid", "stopOrder": 1, "minutesFromStart": 0 },
    { "geofenceId": "uuid", "stopOrder": 2, "minutesFromStart": 15 }
  ]
}
```

---

## 7. Salidas Diarias (Daily Tickets)

### 7.1. Registrar Pago de Salida
- **URL**: `POST /v1/daily-ticket/create`
- **Request Body**:
```json
{
  "vehicleId": "uuid",
  "driverId": "uuid",
  "routeId": "uuid",
  "totalAmount": 15.50,
  "adminFee": 5.00,
  "routeFee": 10.50,
  "workDate": "2024-05-11"
}
```

---

## 8. Infracciones (Infractions)

### 8.1. Crear Infracción
- **URL**: `POST /v1/infractions/create`
- **Request Body**:
```json
{
  "vehicleId": "uuid",
  "type": "RETRASO_RUTA",
  "amount": 10.00,
  "description": "Retraso excesivo en paradero 3"
}
```

### 8.2. Pagar Infracción
- **URL**: `PATCH /v1/infractions/:id/pay`
- **Request Body**: `{ "paymentId": "OP-778899" }`

---

## 9. Tabla de Errores Comunes

| Código | HTTP | Mensaje |
| :--- | :--- | :--- |
| `VAL_001` | 400 | Error de validación en los datos enviados |
| `AUTH_001` | 401 | Credenciales incorrectas o Token inválido |
| `RES_001` | 404 | El recurso solicitado no existe |
| `BIZ_001` | 409 | Conflicto: El registro ya existe |
| `INT_001` | 500 | Error crítico en el servidor |

---

*Para ver los esquemas completos de cada objeto, consulta la interfaz interactiva en `/docs`.*
