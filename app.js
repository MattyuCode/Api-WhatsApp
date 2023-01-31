const {
    Client,
    MessageMedia,
    LocalAuth
} = require("whatsapp-web.js");

const {
    body,
    validationResult
} = require("express-validator");

const {
    formatoNumeroTelefono
} = require("./config/formatoNumero");

// Imports
const express = require("express");
const socketIo = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const mime = require("mime-types");

//Declarations of variables
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 6060;

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);

// const SESSION_FILE_PATH = "./whatsapp-session.json";
// let sessionCfg;
// if (fs.existsSync(SESSION_FILE_PATH)) {
//     sessionCfg = require(SESSION_FILE_PATH);
// }

app.use(fileUpload({
    debug: false
}));

app.get("/", (req, res) => {
    // res.status(200).json({
    //     status: true,
    //     message: 'Bienvenido a WhatsApp 👏🤣❤'
    // })

    res.sendFile("index.html", {
        root: __dirname,
    });
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
    // session: sessionCfg,
    authStrategy: new LocalAuth(),
});

// client.on("qr", (qr) => {
//     console.log("QR received", qr);
//     // qrcode.generate(qr);
// });

// client.on("authenticated", (session) => {
//     console.log("Authenticated", session);
//     sessionCfg = session;
//     fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
//         if (err) {
//             console.error(err);
//         }
//     });
// });

client.on("message", (msg) => {
    console.log(msg.body);
    if (msg.body === "Hola") {
        msg.reply("Hola, muy buen día en que puedo ayudarte");
       
        client.getChats().then((chats) => {
            console.log(chats[0])
        })
    
    } else if (msg.body === "Buenos días") {
        // msg.sendMessage(msg.from, "Buenos días en que puedo ayudarte");
        msg.reply("Buenos días en que puedo ayudarte");

        // si es en grupos donde se verifica el numero de telefono
    } else if (msg.body === "!groups") {
        client
            .getChats()
            .then((chats) => {
                //se buscar los chats si es en grupos
                const grupos = chats.filter((m) => m.isGroup);

                if (grupos.length === 0) {
                    msg.reply("No hay grupos");
                } else {
                    let responderMensaje = "TUS GRUPOS\n\n";
                    //para buscar los grupos con el nombre y le ID
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

    /*//¡NOTA!
          DESCOMENTE EL GUIÓN A CONTINUACIÓN SI DESEA GUARDAR LOS ARCHIVOS DE MEDIOS DEL MENSAJE
          Descarga de medios*/
});

client.initialize();

//Con Socket IO
// io.on("connection", function (socket) {
io.on("connection", (socket) => {
    socket.emit("message", "Conectando....!");

    client.on("qr", (qr) => {
        console.log("QR received", qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit("qr", url);
            socket.emit("message", "Código QR recibido, escanear por favor!");
        });
    });

    //Para concectar el cliente
    client.on("ready", () => {
        console.log("Usuario conectado");
        socket.emit("ready", "WhatsApp está listo");
        socket.emit("message", "Usuario conectado");
    });

    // //para guardar el authentication del cliente
    // client.on("authenticated", (session) => {
    //     socket.emit("ready", "WhatsApp está autenticado");
    //     socket.emit("message", "WhatsApp está autenticado");
    //     console.log("Authenticated", session);
    //     sessionCfg = session;
    //     fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
    //         if (err) {
    //             console.error(err);
    //         }
    //     });
    // });

    //Para autenticación el WhatasApp
    client.on("authenticated", () => {
        socket.emit("authenticated", "WhatsApp está autenticado");
        socket.emit("message", "WhatsApp está autenticado");
        console.log("AUTENTICADO");
    });

    //Para el fallo de inicio de session el WhatasApp
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

const verNumeroRegistrado = async (numero) => {
    const esRegistrado = await client.isRegisteredUser(numero);
    return esRegistrado;
};

//Enviar mensajes por POST
// app.post('/send', (req, res) => {
//     console.log(req.body);
//     // io.emit("message", req.body);

//     const numero = req.body.numero;
//     const mensajes = req.body.mensajes;

//     client
//         .sendMessage(numero, mensajes)
//         .then((response) => {
//             res.status(200).json({
//                 status: true,
//                 response: response,
//                 // message: "Mensaje enviado",
//             });
//         })
//         .catch((err) => {
//             res.status(500).json({
//                 status: false,
//                 response: err,
//             });
//         });
// });

/**
 * Enviar mensajes por POST------------------------------------------>
 */
app.post(
    "/enviar-mensaje",
    [body("number").notEmpty(), body("message").notEmpty()],
    async (req, res) => {
        const errores = validationResult(req).formatWith(({
            msg
        }) => {
            return msg;
        });

        //validamos si es diferente de vacio
        if (!errores.isEmpty()) {
            return res.status(422).json({
                status: false,
                message: errores.mapped(),
                // message: "No se puede conectar",
            });
        }

        const number = formatoNumeroTelefono(req.body.number);
        const message = req.body.message;
        const esNumeroRegistrado = await verNumeroRegistrado(number);

        // Si esNumeroRegistrado es falso || osea que si el numero no esta registrado todavia
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

/**
 * Enviar archivos para un numero------------------------------------->
 */
app.post("/enviar-archivo", async (req, res) => {
    const number = formatoNumeroTelefono(req.body.number);
    const caption = req.body.caption;
    const fileUrl = req.body.file;

    let mimetype;
    const attachment = await axios.get(fileUrl, {
        responseType: 'arraybuffer'
    }).then(response => {
        mimetype = response.headers['content-type'];
        return response.data.toString('base64');
    });
    const media = new MessageMedia(mimetype, attachment, 'Media');

    client.sendMessage(number, media, {
            caption: caption
        }).then((response) => {
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

})


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
app.post("/enviarMensajeEnGrupo", [
    body("id").custom((value, {
        req
    }) => {
        if (!value && !req.body.name) {
            throw new Error("Invalid value, you can use `ID` or `name`");
        }
        return true;
    }),
    body("message").notEmpty(),
], async (req, res) => {
    const errores = validationResult(req).formatWith(({
        msg
    }) => {
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
                message: 'NO group found with name:',
                groupName,
            });
        }
        chatId = group.id._serialized;
    }

    client.sendMessage(chatId, message)
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


/**
 * Para ejecutar en el puerto
 */
server.listen(port, () => console.log("Aplicacion conrriendo el puerto 🏍🚨🚦:", port));