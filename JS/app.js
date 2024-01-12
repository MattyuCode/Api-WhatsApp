// PASAR EL OTRO PARAMETRO DE "TYPE": "module" y tambien install npm i -D nodemon
import pkg from "whatsapp-web.js";
import { body, validationResult } from "express-validator";
import express from "express";
import { Server } from "socket.io";
import qrcode from "qrcode";
import http from "http";
import https from "https";
import fs from "fs";
import fileUpload from "express-fileupload";
import axios from "axios";
import mime from "mime-types";
import path from "path";
import { formatoNumeroTelefono } from "../Utilities/formatoNumero.js";
import multer from "multer";


const { Client, MessageMedia, LocalAuth } = pkg;
const app = express();

//Instalacion de certificado
const options = {
  key: fs.readFileSync("./JS/ssl/server.key"),
  cert: fs.readFileSync("./JS/ssl/certificate.crt"),
  ca: fs.readFileSync("./JS/ssl/intermediate.crt"),
};


const httpServer = http.createServer(app);
// const httpServer = https.createServer(options, app);
const io = new Server(httpServer);
const port = process.env.PORT || 6060;
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(
  fileUpload({
    debug: false,
  })
);

/*
//BUG: solo con require
app.get("/", (req, res) => {
  res.sendFile("home/index.html", {
    //NOTE root: __dirname,
     root: __dirname + '/../',
  });
});*/

// BUG Con import from path
app.get("/", (req, res) => {
  const filePath = path.join(process.cwd(), "Home", "index.html");
  res.sendFile(filePath);
});

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  },
  authStrategy: new LocalAuth(),
});

io.on("connection", (socket) => {
  socket.emit("message", "Conectando....!");

  // Se genera un QR para poder escanearlo en el navegador
  client.on("qr", (qr) => {
    console.log("QR received", qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit("qr", url);
      socket.emit("message", "Código QR recibido, escanear por favor!");
    });
  });

  //Para conectarse al WhatsApp
  client.on("ready", () => {
    console.log("Usuario conectado");
    socket.emit("ready", "WhatsApp está listo");
    socket.emit("message", "Usuario conectado");
  });

  //Para autenticación del WhatasApp
  client.on("authenticated", () => {
    socket.emit("authenticated", "WhatsApp está autenticado");
    socket.emit("message", "WhatsApp está autenticado");
    console.log("AUTENTICADO");
  });

  //Para el fallo de inicio de session al WhatasApp
  client.on("auth_failure", (session) => {
    socket.emit("message", "Error de autenticación, reiniciando...");
    console.log("ERROR REINICIANDO AUTTENTICACION");
  });

  //Para desconectarse al  WhatasApp
  client.on("disconnected", (reason) => {
    socket.emit("message", "Whatsapp está desconectado!");
    client.destroy();
    client.initialize();
  });
});

const document = MessageMedia.fromFilePath(`./Source/document.pdf`);

client.on("message", (msg) => {
  console.log("==========================");
  console.log("De:",msg.from);
  console.log("Para:",msg.to);
  console.log(msg.body);
  console.log("==========================");

  if (msg.body === "Hola") {
    // msg.reply("Hola, Carlos muy buenas tardes en que puedo ayudarte solo escribe *AYUDA* si necesitas algo");
    msg.reply(`Hola, Carlos muy buenas tardes en que puedo ayudarte solo escribe *AYUDA* si necesitas algo`);
    // El metodo getChats() nos servira para mostrar en el chat si es un grupo y nos dara el id
    client.getChats().then((chats) => {
      console.log("msg",msg);
      console.log(chats[0]);
    });
  } else if (msg.body === "Buenos días") {
    msg.reply("Buenos días en que puedo ayudarte");

  } else if (msg.body === "DOC") {
    return client.sendMessage(message.from, document, {
      caption: "Este es una documentacion de APIs",
    });

  } else if (
    msg.body === "grupos" ||
    msg.body === "Grupos" ||
    msg.body === "Ver grupos"
  ) {
    // El metodo getChats() nos sirve para para generar solamente el ID y nombre de los grupos encontrados
    client
      .getChats()
      .then((chats) => {
        const grupos = chats.filter((listaGrupos) => listaGrupos.isGroup);
        if (grupos.length === 0) {
          msg.reply("No hay grupos");
        } else {
          let responderMensaje = "Aqui estan tus grupos:\n\n";
          grupos.forEach((grupo, i) => {
            responderMensaje += `ID: ${grupo.id._serialized}\nName: ${grupo.name}\n\n`;
          });
          responderMensaje +=
            "_Puede usar la identificación del grupo para enviar un mensaje al grupo._";
          msg.reply(responderMensaje);
        }
      })
      .catch((err) => console.error(err));
  }
});

client.initialize();

const verNumeroRegistrado = async (numero) => {
  const esRegistrado = await client.isRegisteredUser(numero);
  return esRegistrado;
};

/**
 MAT: El metodo para enviar mensaje 
 * Enviar mensajes por POST------------------------------------------>
 */
app.post(
  "/enviar-mensaje",
  [body("number").notEmpty(), body("message").notEmpty()],
  async (req, res) => {
    const errores = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errores.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errores.mapped(),
      });
    }

    const number = formatoNumeroTelefono(req.body.number);
    const message = req.body.message;
    const esNumeroRegistrado = await verNumeroRegistrado(number);

    if (!esNumeroRegistrado) {
      return res.status(422).json({
        status: false,
        message: "El número ingresado no está registrado",
      });
    }

    client
      .sendMessage(number, message)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

app.post("/enviar-archivo", [
  body("number").notEmpty(),
  body("filename").notEmpty(),
]),
  async (req, res) => {
    const errores = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });
    if (!errores.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: "Hubo un error" + errores.mapped(),
      });
    }

    const number = formatoNumeroTelefono(req.body.number);
    const fileName = req.body.filename;
    const esNumeroRegistrado = formatoNumeroTelefono(req.body.number);

    if (!esNumeroRegistrado) {
      return res.status(422).json({
        status: false,
        message: "Hay un error",
      });
    }

    try {
      const buffer = await fs.promises.readFile(fileName);
      await client.sendFile(
        number,
        buffer,
        fileName,
        `Archivo enviado: ${fileName}`
      );
      res.status(200).json({
        status: true,
        message: "Archivo enviado con exito",
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: "Hubo un error: " + error.message,
      });
    }
  };

/*
 * Enviar archivos para un numero------------------------------------->
 */

app.post("/enviar-archivo", async (req, res) => {
  const number = formatoNumeroTelefono(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req.body.file;

  let mimetype;
  const attachment = await axios
    .get(fileUrl, {
      responseType: "arraybuffer",
    })
    .then((response) => {
      mimetype = response.headers["content-type"];
      return response.data.toString("base64");
    });
  const media = new MessageMedia(mimetype, attachment, "Media");

  client
    .sendMessage(number, media, {
      caption: caption,
    })
    .then((response) => {
      res.status(200).json({
        status: true,
        response: response,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});

const buscarGrupoPorNombre = async (req, res) => {
  const grupo = await client.getChats().then((chats) => {
    return chats.find(
      (chts) => chts.isGroup && chts.name.toLowerCase() === name.toLowerCase()
    );
  });

  return grupo;
};

/**
 * Enviar mensaje por grupo de whatsapp--------------------------------------------->
 */

app.post(
  "/enviarMensajeEnGrupo",
  [
    body("id").custom((value, { req }) => {
      if (!value && !req.body.name) {
        throw new Error("Invalid value, you can use `ID` or `name`");
      }
      return true;
    }),
    body("message").notEmpty(),
  ],
  async (req, res) => {
    const errores = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errores.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errores.mapped(),
      });
    }

    let chatId = req.body.id;
    const groupName = req.body.name;
    const message = req.body.message;

    if (!chatId) {
      const group = await buscarGrupoPorNombre(groupName);
      if (!group) {
        return res.status(422).json({
          status: false,
          message: "NO group found with name:",
          groupName,
        });
      }
      chatId = group.id._serialized;
    }

    client
      .sendMessage(chatId, message)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

app.post(
  "/enviarArchivoGrupo2",
  [
    body("id").custom((value, { req }) => {
      if (!value && !req.body.name) {
        throw new Error("Invalid value, you can use `ID` or `name`");
      }
      return true;
    }),
    body("message").notEmpty(),
    // body("file").notEmpty(),
  ],
  async (req, res) => {
    const errores = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errores.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errores.mapped(),
      });
    }

    let chatId = req.body.id;
    const groupName = req.body.name;
    const message = req.body.message;
    const fileUrl = req.body.file;

    let mimetype;
    const attachment = await axios
      .get(fileUrl, {
        responseType: "arraybuffer",
      })
      .then((response) => {
        mimetype = response.headers["content-type"];
        return response.data.toString("base64");
      });
    const media = new MessageMedia(mimetype, attachment, "Media");

    if (!chatId) {
      const group = await buscarGrupoPorNombre(groupName);
      if (!group) {
        return res.status(422).json({
          status: false,
          message: "NO group found with name:",
          groupName,
        });
      }
      chatId = group.id._serialized;
    }

    client
      .sendMessage(chatId, message, media)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

//NOTE: PARA ENVIAR UN ARCHIVO CON MENSAJE EN UN GRUPO DE WHATSAPP
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage }).single("file");

app.post(
  "/enviarArchivoGrupo",
  [
    body("id").custom((value, { req }) => {
      if (!value && !req.body.name) {
        throw new Error("Invalid value, you can use 'ID' or 'name'");
      }
      return true; // si no que regrese verdadero para poder serguir con el codigo
    }),
    body("message").notEmpty(),
  ],
  async (req, res) => {
    const errores = validationResult(req).formatWith(({ message }) => message);

    if (!errores.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: "hay un error aqui" + errores.mapped(),
      });
    }

    let chatId = req.body.id;
    const groupName = req.body.name;
    const message = req.body.message;

    if (!chatId) {
      const group = await buscarGrupoPorNombre(groupName);
      if (!group) {
        return res.status(422).json({
          status: false,
          message: "No group found with name",
          groupName,
        });
      }
      chatId = group.id._serialized;
    }

    upload(req, res, async function (errores) {
      if (errores) {
        return res.status(500).json({
          status: false,
          response: "Aqui hay un error en el upload",
          errores,
        });
      }

      const file = req.file;
      const filePath = file ? file.path : "";
      let media;
      if (file) {
        media = MessageMedia.fromFilePath(filePath);
      } else if (req.body.file) {
        media = MessageMedia.fromFilePath(req.body.file);
      } else {
        media = null;
      }

      try {
        await client.sendMessage(chatId, message, { media });
        res.status(200).json({ status: true, response: response });
      } catch (error) {
        res.status(500).json({
          status: false,
          response: "Error al enviar el archivo",
          error,
        });
      }

      // client
      //   .sendMessage(chatId, message, {
      //     file: filePath,
      //   })
      //   .then((response) => {
      //     res.status(200).json({ status: true, response: response });
      //   })
      //   .catch((errores) => {
      //     res.status(500).json({ status: false, response: errores });
      //   });
    });
  }
);

httpServer.listen(port, () =>
  console.log(
    "Aplicación corriendo en el puerto 🏍🚨🚦: ",
    `http://localhost:${port}`
  )
);
