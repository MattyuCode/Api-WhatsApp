#                           Api WhatsApp - Mattyu's

<img src="img/image.png" alt="">
 


## ¡Cosa importante!

Debido a que Whatsapp se actualiza periódicamente, debemos usar siempre **la última versión de whatsapp-web.js**. Pueden ocurrir algunos errores con las versiones anteriores, así que intente actualizar la versión de la biblioteca antes de crear un problema.

### ¿Cómo utilizar?

- Clonar o descargar este repositorio
- Entrar al directorio del proyecto
- Ejecute `npm install`
- Ejecute `npm run start:dev`
- Abra el navegador y vaya a la dirección `http://localhost:6060`
- Escanea el código QR
- ¡Disfrutar!

### Enviar mensaje al grupo

Puede enviar el mensaje a cualquier grupo utilizando `chatID` o grupo `name`, chatID se usará si especifica el campo `id` en el formulario, por lo que si desea enviar por `name`, solo use el nombre.

**Parámetros:**

- `id` (opcional si se da el nombre): el ID del chat
- `name` (opcional): nombre del grupo
- `mensaje`: el mensaje

Aquí el punto final: `/send-group-message`

Aquí la forma de obtener la información de los grupos (incluyendo ID y nombre):

- Enviar un mensaje al número de API `!groups`
- La API responderá con la información de los grupos.
- Use la identificación para enviar un mensaje

### Descargando medios

Agrego un ejemplo para descargar los medios del mensaje, si existe. ¡Compruébelo en el evento 'en mensaje'!

Usamos el paquete `mime-types` para obtener la extensión del archivo por su tipo mime, para que podamos descargar todo el tipo de mensaje multimedia.

Y decidimos (para este ejemplo) usar el tiempo como nombre de archivo, porque no es seguro que exista el nombre del archivo multimedia.