# Valto Mates — tienda base

Versión estática, responsive y sin proceso de build. Se puede subir directamente a GitHub + Netlify.

## Incluye
- Home responsive con identidad Valto Mates.
- Barra de promociones editable.
- Hero, categorías dinámicas, búsqueda y ordenamiento.
- Catálogo con paginación.
- Ficha de producto en modal.
- Botones de consulta por WhatsApp.
- Sección de combos.
- Panel `/admin.html` para editar textos, colores, categorías y productos.
- Exportación/importación JSON.
- Estructura SQL lista para Supabase, incluyendo categorías.

## Antes de publicar
1. Editar `config.js` y cargar `whatsappNumber` en formato internacional, sin `+` ni espacios. Ejemplo Argentina: `549221...`.
2. Si se desea, cargar `instagramUrl`.
3. Revisar catálogo y precios definitivos.
4. Reemplazar/añadir imágenes en `assets/img/`.

## Pagos
No hay integración de tarjeta ni Mercado Pago en esta entrega. Los botones llevan a WhatsApp y permiten coordinar efectivo/transferencia. La integración de checkout puede agregarse después.

## Supabase
El panel actualmente usa `localStorage`, ideal para demo. `supabase.sql` deja creadas las tablas y políticas base para pasar a persistencia real. Al conectarlo, conviene agregar Supabase Auth al panel para que solo el cliente pueda editar.

## Netlify
No requiere `npm install`, `npm run build` ni funciones. Public directory: la raíz del repositorio.
