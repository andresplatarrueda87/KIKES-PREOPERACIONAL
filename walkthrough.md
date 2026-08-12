# Walkthrough de la Aplicación Preoperacional Motocicletas

Se ha completado la creación de la aplicación web progresiva (**PWA**) para automatizar de forma local y offline el registro del formulario **Preoperacional Motocicletas/Motocargueros (Código GMA-F-10, Versión 05)**.

La aplicación está diseñada para ejecutarse de forma local y permite ser instalada como una aplicación nativa tanto en computadoras de escritorio (Windows/macOS) como en dispositivos Android.

---

## Archivos Creados en el Proyecto

1. **[`serve.py`](serve.py):** Script de servidor local multiproceso en Python que corre en el puerto `8080` (libre de almacenamiento en caché para agilizar las pruebas de desarrollo).
2. **[`manifest.json`](manifest.json):** Define los parámetros de aplicación nativa installable (PWA) de la aplicación.
3. **[`sw.js`](sw.js):** Registra el *Service Worker* que almacena en la caché del navegador los archivos del sistema y librerías externas para permitir el funcionamiento 100% offline.
4. **[`index.html`](index.html):** Contiene la estructura de la aplicación (SPA), incluyendo la barra de navegación diaria (Lunes a Domingo), el selector de semanas, perfiles rápidos y la plantilla de generación de PDF.
5. **[`style.css`](style.css):** Diseña una interfaz premium con colores corporativos Kikes en modo oscuro. Incluye la adaptación de botones táctiles sobredimensionados para respuestas rápidas de conforme/no conforme, y reglas de formato para impresión del reporte PDF.
6. **[`app.js`](app.js):** Desarrolla toda la lógica de negocio, inicialización de IndexedDB (con Dexie.js) para el histórico local, manejo de firmas digitalizadas en pantalla y compilación/descarga de PDFs mediante `html2pdf.js`.

---

## Solución a los Requerimientos del Usuario

### 1. Llenar por Defecto con un Botón (Semana)
- En la parte superior de la tarjeta de metadatos, el botón **"Toda la Semana OK"** permite autocompletar los 7 días de la semana con respuestas "Conforme" (C). Automáticamente estima un kilometraje incremental partiendo del último registro disponible y define un nivel de combustible base para agilizar el llenado.

### 2. Llenar por Defecto el Día
- En la sección del día activo, el botón **"Llenar Día como Conforme (C)"** marca automáticamente todos los ítems de ese día en Conforme.
- Al hacer clic sobre los interruptores de los ítems, el usuario puede alternar de manera rápida e individual la respuesta a Conforme (C) o No Conforme (NC).

### 3. Set de Respuestas por Defecto (Perfiles y Operadores)
- En la sección de **Ajustes**, el usuario puede configurar de manera separada:
  - **Perfiles de Vehículos** (Placa, Zona, Área de Proceso, e indicador de Nivel de Gasolina: SÍ o NO).
  - **Gestión de Operadores** (Nombre Completo y Firma digitalizada).
- Desde la pestaña **Registrar**, el usuario puede:
  - Cargar los datos del vehículo usando el menú **"Cargar Perfil Rápido"**.
  - Cargar el nombre y firma del conductor usando el menú **"Cargar Operador"** situado directamente debajo de la sección de metadatos. Esto rellenará su nombre e insertará automáticamente su firma digitalizada en el panel de dibujo del operador de turno. También se permite firmar o corregir la firma en tiempo real.

### 3.2. Lógica Inteligente para Nivel de Gasolina (N/A)
- En **Ajustes**, al crear un perfil de vehículo, se indica si posee indicador de gasolina.
- En **Registrar**, al cargar o ingresar la placa de un vehículo sin indicador ("NO"), la interfaz oculta los niveles normales (E, 1/4, etc.) y activa/bloquea el botón **"N/A" (no aplica)** para los registros diarios.
- En la exportación, el reporte PDF resultante estampa de forma automática `"N/A"` centrado en las casillas de combustible de ambas páginas.


### 3.1. Selección Flexible de Semanas
- El menú de selección de semanas carga por defecto las **últimas 5 semanas**.
- Al elegir la opción **"Otra semana..."**, se despliega de manera inmediata un selector de fecha/semana de tipo calendario que permite al usuario escoger e inicializar cualquier semana anterior en el histórico de registros.

### 4. Histórico Local (Base de Datos)
- La aplicación implementa **IndexedDB** a través de la librería `Dexie.js`. Esto crea una base de datos local y transaccional en el propio navegador o dispositivo móvil.
- Cuenta con opciones para **Exportar base de datos en JSON** (para respaldar o transferir a otros dispositivos) e **Importar base de datos** en la sección de Ajustes. Al realizar la importación, el sistema actualiza de forma automática el panel táctil de firmas y recarga la vista activa con los datos restaurados.
- El panel de **Histórico** lista todas las semanas registradas con búsquedas por placa, permitiendo volver a editarlas o descargar sus PDFs.

### 5. Modificación Directa sobre PDF Original (pdf-lib)
- La aplicación ahora utiliza la librería local **`pdf-lib.min.js`** para interactuar directamente con la plantilla oficial en formato PDF.
- Al presionar **"Generar PDF"**, el sistema carga en memoria el archivo original **`GMA-F-10 PREOPERACIONAL MOTOCICLETAS.docx.pdf`** y sobreescribe de manera exacta:
  - Los textos de placa, fechas, días del mes, kilometraje, niveles de combustible y observaciones.
  - Coloca las marcas de **`X`** en las casillas correspondientes de Conforme (C) o No Conforme (NC) de cada día con coordenadas milimétricas.
  - En la Página 2, dibuja una rejilla ordenada de observaciones y estampa la fecha, nombre y firma digitalizada real del operador en las columnas del cuadro de firmas oficial.
- Esto garantiza que el documento final sea 100% oficial y conserve la estructura y resolución original sin usar aproximaciones HTML/CSS.
