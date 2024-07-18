const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const fs = require("fs");
const { read } = require('read')


// if /data folder doesnt exist, create it
if (!fs.existsSync(__dirname + "/data"))
    fs.mkdirSync(__dirname + "/data");

// if /data/files folder doesnt exist, create it
if (!fs.existsSync(__dirname + "/data/files"))
    fs.mkdirSync(__dirname + "/data/files");

// if /data/links file doesnt exist, create it
if (!fs.existsSync(__dirname + "/data/links.json"))
    fs.writeFileSync(__dirname + "/data/links.json", "{}", "utf8");


let USE_HTTPS = false;

if (process.argv[2] && process.argv[2] === '-https')
    USE_HTTPS = true;
else
    USE_HTTPS = false;


if (USE_HTTPS && !fs.existsSync(__dirname + "/data/ssl"))
{
    console.log("SSL FOLDER DOESNT EXIST");
    console.log("> Either host the server using http (set USE_HTTPS to false) or create the ssl keys.");
    console.log();
    console.log("To create the ssl keys, open a terminal in the data folder and run the following commands:");
    console.log("mkdir ssl");
    console.log("cd ssl");
    console.log("openssl genrsa -out key.pem");
    console.log("openssl req -new -key key.pem -out csr.pem");
    console.log("openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem");
    return;
}

var server;
if (!USE_HTTPS)
    server = http.createServer(app);
else
    server = https.createServer(
        {
            key: fs.readFileSync(__dirname + "/data/ssl/key.pem"),
            cert: fs.readFileSync(__dirname + "/data/ssl/cert.pem"),
        },
        app);

const { Server } = require("socket.io");
const io = new Server(server, {
    maxHttpBufferSize: 20*1024*1024
});
io.setMaxListeners(1000);

var cookies = require("cookie-parser");
app.use(cookies());

app.get('/', (req, res) => {
    res.redirect('/index/index.html');
});

app.get('/*', async (req, res) => {
    let url = req.url;
    if (url.startsWith('/file/'))
    {
        url = url.substring(6);
        url = url.replace("..", "");
        console.log(`> Accessing "${url}"`)
        await fileUpload.sendFile(req, res, url);
        return;
    }

    if (!url.startsWith('/shared/'))
    {
        if (url.indexOf(".") == -1)
        {
            res.redirect(url + url + ".html");
            return;
        }
        url = "/pages" + url;
    }

    url = url.replace("..", "");

    if (url.indexOf("?") != -1)
        url = url.substring(0, url.indexOf("?"));// url.split("?")[0];

    if (url.indexOf(".") != -1 && !fs.existsSync(__dirname + url))
        res.redirect('/404/404.html');
    else
        res.sendFile(__dirname + url);
});

const sessionSystem = require('./yesServer/sessionSystem')
const dbInterface = require("./yesServer/dbInterface.js");
const accountInterface = require("./yesServer/accountInterface.js");
const accountSystem = require("./yesServer/accountSystem.js");
const securityInterface = require("./yesServer/securityInterface.js");
const fileUpload = require("./yesServer/fileUpload.js");

async function startUp()
{
    sessionSystem.initApp();
    await dbInterface.initApp();
    await accountInterface.initApp(dbInterface);
    await securityInterface.initApp();
    await accountSystem.initApp(app, io, accountInterface, securityInterface, sessionSystem);
    await fileUpload.initApp(app, io, dbInterface, accountInterface, securityInterface, sessionSystem, !USE_HTTPS);

    if ((await accountInterface.getAllUsers()).length === 0)
    {
        console.log("> NO USERS!");

        const username = await read({prompt: "Username: "});
        const password = await read({prompt: "Password: ", silent: true, replace: "*"});

        let res = await accountSystem.registerUser(username, password);
        console.log(res);
    }

    let port = USE_HTTPS ? 443 : 80;
    server.listen(port, () => {
        console.log('> Started server on *:'+port);
    });
}

startUp().then();
