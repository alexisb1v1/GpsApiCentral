# 📋 Plan de Implementación: Monitoreo de Flota con Mapa Interactivo para el Perfil de Cobrador (Vectura)

Para cumplir con el estándar de arquitectura definido en `D:\Personal\Skill\skill-backend.md` y alinearnos estrictamente con los diseños de la guía de estilo de **Vectura** ([desing.md](file:///d:/Personal/Repositorios/GpsCentral/documento/diseño/desing.md) y [marca.md](file:///d:/Personal/Repositorios/GpsCentral/documento/diseño/marca.md)), definimos el plan técnico de desarrollo para el perfil de Cobrador.

---

## 🎨 Alineación con el Estándar de Diseño de Vectura

La interfaz para el cobrador se basará en un enfoque **Mobile-First / PWA** premium, ya que este perfil opera principalmente en exteriores y paraderos:

1. **Paleta de Colores Corporativa:**
   * **Color de Énfasis (Primary):** Azul Vectura (`#2563eb`) para llamadas a la acción, marcadores principales y barra de estado de navegación activa.
   * **Fondo de Cuerpo (Background):** `#f7f9fb` (gris muy suave) para minimizar el cansancio ocular.
   * **Superficies (Surface):** `#ffffff` para tarjetas, con bordes sutiles de `1px solid #e2e8f0` y sombra sutil `shadow-sm`.
   * **Bordes Redondeados (Border Radius):** Estilo **`12px`** (`rounded-xl`) estricto en todos los contenedores flotantes, tarjetas de vehículos y paneles de control.

2. **Tipografía e Iconografía:**
   * Uso exclusivo de la fuente **Inter**.
   * Estilo numérico: Alineación con `tabular-nums` para lectura impecable de velocidad y tiempos de llegada.
   * Iconos: **Material Symbols (Rounded)** con esquinas redondeadas para mantener una estética amigable e intuitiva.

3. **Interacción y PWA:**
   * **Bottom Navigation Bar (Navegación Móvil):** Transición automática de la sidebar de escritorio a una barra inferior táctil con un área táctil mínima de `48px`.
   * **Efecto de Desenfoque (Glassmorphism):** Los paneles deslizables del mapa en dispositivos móviles contarán con `backdrop-filter: blur(12px)` para crear una sensación de capas limpias y modernas.
   * **Micro-animaciones:** Transiciones de `200ms ease-in-out` y escala suave `scale-95` en eventos de pulsación táctil.

---

## 🛠️ Cambios Estructurados en el Sistema

### 1. Backend (`GpsApiCentral`)

#### [MODIFY] [monitoring.gateway.ts](file:///d:/Personal/Repositorios/GpsApiCentral/src/monitoring/interfaces/ws/monitoring.gateway.ts)
* Optimizar la transmisión de WebSocket de geolocalización en tiempo real para filtrar la flota asignada al cobrador.
* Incluir en el payload los detalles del estado del boleto diario (`daily-ticket`) asociado a la unidad para que el cobrador tenga visualización del progreso del cobro desde el mapa.

---

### 2. Frontend (`GpsCentral`)

#### [MODIFY] [gps-map.component.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/shared/components/maps/gps-map.component.tsx)
* Reutilizar el modo **`'controller'`** ya existente en el mapa (`GpsMapProps`) para la visualización del cobrador. Esto nos permite aprovechar que ya desactiva los controles de edición de Geoman y muestra la flota/paraderos en tiempo real, garantizando consistencia técnica.
* Diseñar popups minimalistas usando tipografía Inter y bordes redondeados a `12px` que muestren información enfocada en el cobro:
  * Placa y nombre del chofer.
  * Último boleto diario emitido.
  * Velocidad y hora de última actualización.

#### [NEW] [CollectorMonitoringPage.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/features/collector/ui/CollectorMonitoringPage.tsx)
* Página principal que aloja el componente de mapa a pantalla completa.
* Paneles laterales (escritorio) y hojas deslizables (móvil) que listan los autobuses en servicio y su recaudación activa.
* Conexión por WebSocket para la actualización fluida y en tiempo real de la posición de la flota.

#### [NEW] [CollectorLayout.tsx](file:///d:/Personal/Repositorios/GpsCentral/src/app/features/collector/ui/CollectorLayout.tsx)
* Layout base responsive que implementa el Bottom Navigation Bar táctil siguiendo los estándares de marca Vectura.

---

## 🚦 Plan de Verificación

* **Pruebas de Estilo:** Corroborar mediante el inspector del navegador que las tipografías sean Inter, los bordes redondeados de las tarjetas sean de `12px` y los colores correspondan a los tokens oficiales de Vectura.
* **Prueba de WebSockets:** Verificar la actualización fluida y el centrado del mapa en la unidad activa sin interrupciones en la renderización del mapa.
