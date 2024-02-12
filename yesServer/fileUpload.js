let app;
let io;
let accountInterface;
let securityInterface;
let sessionSystem;
let fs = require('fs');
const filesFolder = "./data/files/";
let urlBase = "http://localhost/file/";
const resolve = require('path').resolve;


async function initApp(_app, _io, _accountInterface, _securityInterface, _sessionSystem, local)
{
    app = _app;
    io = _io;
    accountInterface = _accountInterface;
    securityInterface = _securityInterface;
    sessionSystem = _sessionSystem;

    urlBase = local ? "http://localhost/file/" : "https://cdn.marceldobehere.com/file/";

    if (!fs.existsSync(filesFolder))
        fs.mkdirSync(filesFolder);

    io.on("connection", (socket) => {
        socket.on("upload", (file) => {

            let session = sessionSystem.getSessionBySocket(socket);
            if (session === undefined)
                return socket.emit({ message: "invalid session" });

            if (file === undefined || file.filename === undefined || file.data === undefined)
                return socket.emit({ message: "invalid file" });

            console.log("> UPLOAD!");
            //console.log(file); // data:application/x-zip-compressed;base64,U...

            let buff = Buffer.from(file.data, 'base64');
            //let data = buff.toString('binary');

            let filename = file.filename;
            let ext = filename.split('.').pop();
            if (ext === filename)
                ext = "bin";

            let newFilename = getRandomFreeFileName(ext);
            writeFile(newFilename, buff);

            console.log("> UPLOAD DONE!");

            socket.emit('upload', {url:urlBase+newFilename});
        });
    });
}

function getRandomFreeFileName(ext)
{
    while (true)
    {
        let num = securityInterface.getRandomInt(100000, 10000000000);
        let filename =num + "." + ext;
        let filePath = filesFolder + filename;
        if (!fs.existsSync(filePath))
            return filename;
    }
}

function writeFile(filename, data)
{
    fs.writeFileSync(filesFolder+filename, data);
}

function sendFile(res, filename)
{
    let filePath = filesFolder + filename;
    filePath = resolve(filePath);
    console.log(`> Sending file "${filePath}")`)

    res.sendFile(filePath);
}

module.exports = {initApp, sendFile};