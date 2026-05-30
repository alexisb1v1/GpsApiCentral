# Plan de Implementación: Dashboard Operativo Premium Dinámico

Este documento define el diseño técnico, la arquitectura y el flujo de integración para dinamizar el Dashboard principal de la flota urbana (orientado a administradores y operadores) en la plataforma Vectura, reemplazando los mocks estáticos actuales por métricas consolidadas en tiempo real procedentes de la base de datos del backend de forma eficiente.

---

## 1. Contexto y Objetivos

El dashboard actual del operador en el frontend es una maqueta con datos estáticos (como cobros en dólares `$4,250.00` y contadores de vehículos fijos). El objetivo de este plan es convertirlo en una interfaz viva, dinámica y de alto rendimiento que refleje fielmente la operación del día a día:

1. **Precisión Financiera**: Sumar la recaudación en Soles (`S/`) de todos los tickets diarios y cobros de la fecha actual de forma reactiva.
2. **Estado de Flota**: Reflejar cuántos vehículos están en ruta (despachados con ticket activo hoy) y cuántos siguen pendientes de iniciar su jornada.
3. **Monitoreo Operativo**: Visualizar las últimas unidades despachadas y las alertas recientes de infracciones generadas en caliente.
4. **Acciones Rápidas**: Ofrecer navegación rápida e intuitiva a los flujos de despacho de tickets y registro de penalidades.

---

## 2. Decisiones de Diseño Arquitectónico

Proponemos dos alternativas para la obtención y consolidación de datos, siendo la **Opción A** la más recomendada debido a su rendimiento y limpieza bajo Clean Architecture.

### Opción A (Recomendada): Endpoint Consolidado de Dashboard en el Backend
Crear un query consolidado en el backend (`GET /v1/dashboard/metrics`) bajo el patrón CQRS de NestJS que calcule y devuelva todo el conjunto de datos necesarios en una única transacción de lectura rápida.

* **Ventajas**: 
  * Optimización extrema de ancho de banda y latencia en el frontend (un solo viaje HTTP en lugar de tres consultas paralelas).
  * Lógica de agregación, sumatoria y conteo encapsulada de manera óptima en la base de datos.
  * Facilidad para añadir caché en Redis en fases posteriores de escalabilidad.
* **Componentes Backend a Crear/Modificar**:
  * Un Query: `GetDashboardMetricsQuery` y su respectivo handler `GetDashboardMetricsHandler`.
  * Un Controlador: `GetDashboardMetricsController` expuesto en `/v1/dashboard/metrics`.
  * DTO de salida: `DashboardMetricsResponseDto`.

### Opción B: Consumo Paralelo de Múltiples APIs en el Frontend
El frontend consume simultáneamente los endpoints existentes de `/vehicles`, `/daily-tickets` e `/infractions` y realiza localmente la agregación de datos (filtrado por fecha de hoy, sumatorias y mapeos).

* **Ventajas**:
  * Cero modificaciones de endpoints de base en el backend.
* **Desventajas**:
  * Múltiples viajes HTTP simultáneos ralentizan la carga inicial del cliente en dispositivos móviles o conexiones inestables.
  * Lógica de negocio (como el filtrado exacto del día y la sumatoria) delegada al cliente en lugar de estar centralizada.

---

## 3. Propuesta de Estructura de Datos (DTO Consolidado)

El endpoint `/v1/dashboard/metrics` (filtrado automáticamente por el `tenantId` de la sesión del usuario para garantizar multi-tenancy estricto) devolverá la siguiente estructura JSON premium:

```json
{
  "kpis": {
    "totalRevenueToday": 3540.50,
    "revenueTrendLabel": "+15.2% vs ayer",
    "vehiclesInRouteCount": 12,
    "vehiclesPendingCount": 5
  },
  "monitoringUnits": [
    {
      "id": "TK-88321",
      "vehiclePlate": "ABC-123",
      "vehicleNumber": "104",
      "driverName": "Juan Pérez",
      "routeName": "Ruta A-15",
      "direction": "IDA",
      "dispatchedAt": "2026-05-29T10:45:00Z"
    }
  ],
  "recentAlerts": [
    {
      "id": "INF-9912",
      "vehiclePlate": "F3X-801",
      "type": "RETRASO_RUTA",
      "amount": 25.00,
      "detail": "5 min de retraso en Paradero Norte",
      "createdAt": "2026-05-29T12:30:00Z"
    }
  ],
  "recentTickets": [
    {
      "id": "TK-88321",
      "ticketNumber": "TK-000104",
      "vehiclePlate": "ABC-123",
      "totalAmount": 60.50,
      "dispatchedAt": "2026-05-29T10:45:00Z"
    }
  ]
}
```

---

## 4. Plan de Cambios Propuestos

### Componente Frontend (`GpsCentral`)

#### 1. Modificar [page.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/dashboard/page.tsx)
* Integrar el servicio `DashboardApiService` para cargar el DTO de métricas del día al montar la página.
* Reemplazar los valores de `StatsCard` mockeados por `totalRevenueToday` (en Soles `S/`), `vehiclesInRouteCount` y `vehiclesPendingCount`.
* Consumir `monitoringUnits` en `MonitoringTable` y `recentAlerts` en `AlertsList`.

#### 2. Modificar [MonitoringTable.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/features/dashboard/ui/components/MonitoringTable.tsx)
* Modificar la firma del componente para aceptar las unidades dinámicas como prop.
* Mapear e imprimir la información real de despacho de la unidad y su hora de salida.

#### 3. Modificar [AlertsList.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/features/dashboard/ui/components/AlertsList.tsx)
* Modificar la firma para aceptar las alertas reales (infracciones de hoy).
* Imprimir las descripciones de la infracción y estilizar el badge de acuerdo al nivel de gravedad.

#### 4. Modificar [PreviousTickets.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/features/dashboard/ui/components/PreviousTickets.tsx)
* Aceptar los últimos tickets consolidados y renderizarlos dinámicamente con su formato de hora local.

---

### Componente Backend (`GpsApiCentral`)

#### 1. Crear [dashboard.module.ts](file:///d:/Personal/Repositorios/GpsApiCentral/src/dashboard/infrastructure/nestjs/dashboard.module.ts)
* Crear e inicializar el módulo del Dashboard.
* Registrar el controlador y el handler de consulta CQRS.

#### 2. Crear [get-dashboard-metrics.controller.ts](file:///d:/Personal/Repositorios/GpsApiCentral/src/dashboard/interfaces/http/v1/get-dashboard-metrics.controller.ts)
* Exponer la ruta `@Get('v1/dashboard/metrics')` protegida por `JwtAuthGuard` y `RolesGuard` (`@Roles('ADMIN', 'OPERATOR')`).
* Extraer el `tenantId` del token/cookie y despachar el Query.

#### 3. Crear [get-dashboard-metrics.handler.ts](file:///d:/Personal/Repositorios/GpsApiCentral/src/dashboard/application/queries/v1/get-dashboard-metrics.handler.ts)
* Implementar el handler CQRS.
* Realizar consultas rápidas agregadas sobre:
  1. Conteo y suma de recaudación en `DailyTicketEntity` de la fecha actual.
  2. Conteo de vehículos operativos.
  3. Lectura de las últimas 5 infracciones de hoy.
  4. Lectura de los últimos 5 tickets diarios de hoy.

---

## 5. Plan de Verificación

### Pruebas de Integración y API
* Consumir el endpoint `/v1/dashboard/metrics` vía Swagger o curl y validar la estructura JSON y velocidad de respuesta.
* Registrar una nueva salida diaria en `/payments/new` y verificar que la recaudación aumente de forma inmediata al regresar al Dashboard.
* Registrar una penalidad en `/penalties` y validar que aparezca listada al instante en el módulo de alertas del Dashboard.
