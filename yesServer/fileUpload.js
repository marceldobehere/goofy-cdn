const fs = require('fs');
const resolve = require('path').resolve;

let app;
let io;
let accountInterface;
let securityInterface;
let sessionSystem;
let dbInterface;

let passwordEntries;
const filesFolder = "./data/files/";
let urlBase = "http://localhost/file/";
const chunkSize = 2 * 1024 * 1024; // 2MB

async function initApp(_app, _io, _dbInterface, _accountInterface, _securityInterface, _sessionSystem, local)
{
    app = _app;
    io = _io;
    dbInterface = _dbInterface;
    accountInterface = _accountInterface;
    securityInterface = _securityInterface;
    sessionSystem = _sessionSystem;
    urlBase = local ? "http://localhost/file/" : "https://cdn.marceldobehere.com/file/";

    if (!fs.existsSync(filesFolder))
        fs.mkdirSync(filesFolder);

    if (! await dbInterface.tableExists('file-passwords'))
        await dbInterface.createTable('file-passwords');
    passwordEntries = await dbInterface._getTable('file-passwords');

    io.on("connection", (socket) => {

        socket.on("start-upload", async (data) => {
            let session = sessionSystem.getSessionBySocket(socket);
            if (session === undefined)
                return socket.emit("start-upload", { error: "invalid session" });

            let filename = data.filename;
            if (filename === undefined)
                return socket.emit("start-upload", { error: "invalid filename" });
            let size = data.size;
            if (size === undefined)
                return socket.emit("start-upload", { error: "invalid size" });
            let password = data.password;
            if (password != undefined && typeof password !== "string")
                return socket.emit("start-upload", { error: "invalid password type" });

            // generate random str id
            let id = `id-${securityInterface.getRandomInt(100000, 10000000000)}`;
            let chunkCount = Math.ceil(size / chunkSize);
            session["fileUploads"][id] = {
                filename: filename,
                size: size,
                chunkCount: chunkCount,
                password: password,
                data: []
            };

            console.log(`> START UPLOAD FOR FILE \"${filename}\" (Password: ${password != undefined}, Chunk Count: ${chunkCount})!`);
            return socket.emit("start-upload", { id:id, chunkSize:chunkSize});
        });

        socket.on("do-upload", async (data) => {
            let session = sessionSystem.getSessionBySocket(socket);
            if (session === undefined)
                return socket.emit("do-upload", {error: "invalid session" });
            // console.log("> DO UPLOAD!", data);

            let id = data.id;
            if (id === undefined)
                return socket.emit("do-upload", { error: "invalid id" });
            let chunkIndex = data.chunkIndex;
            if (chunkIndex === undefined)
                return socket.emit("do-upload", { error: "invalid chunkIndex" });
            let dataChunk = data.data;
            if (dataChunk === undefined)
                return socket.emit("do-upload", { error: "invalid chunk" });
            let upload = session["fileUploads"][id];
            if (upload === undefined)
                return socket.emit("do-upload", { error: "invalid upload" });
            if (chunkIndex >= upload.chunkCount || chunkIndex < 0)
                return socket.emit("do-upload", { error: "invalid chunkIndex" });
            if (dataChunk.length > chunkSize)
                return socket.emit("do-upload", { error: "invalid chunk size" });

            //console.log(`> UPLOADING CHUNK ${chunkIndex}!`);
            upload.data[chunkIndex] = dataChunk;

            if (chunkIndex !== upload.chunkCount - 1)
                return socket.emit("do-upload", { status: "ok", left: ((upload.chunkCount - 1) - chunkIndex)});


            let buff = Buffer.concat(upload["data"]);
            console.log(buff);

            let filename = upload.filename;
            let ext = filename.split('.').pop();
            if (ext === filename)
                ext = "bin";

            let newFilename = getRandomFreeFileName(ext);
            writeFile(newFilename, buff);

            if (upload.password != undefined)
            {
                let obj = {
                    password: await securityInterface.hashPassword(upload.password),
                    filename
                };
                passwordEntries[newFilename] = obj;
                await dbInterface.addPair('file-passwords', newFilename, obj);
            }
            else
            {
                let obj = {filename};
                passwordEntries[newFilename] = obj;
                await dbInterface.addPair('file-passwords', newFilename, obj);
            }

            delete session["fileUploads"][id];
            console.log(session["fileUploads"]);

            console.log(`> UPLOADING \"${upload.filename}\" (${Math.floor((upload.size * 100) / (1024 * 1024)) / 100} MB) DONE!`);
            console.log(`> UPLOAD DONE TO "${urlBase+newFilename}"!`);
            return socket.emit("do-upload", { status: "done", url: urlBase + newFilename });
        });

        socket.on("disconnect", async () => {
            console.log("> DISCONNECTED!");
            let session = sessionSystem.getSessionBySocket(socket);
            if (session === undefined)
                return;

            session["fileUploads"] = {};
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

async function sendFile(req, res, filename)
{
    let entry = passwordEntries[filename];
    if (entry === undefined)
    {
        if (fs.existsSync(filesFolder + filename))
        {
            console.log(`> File "${filename}" found but has no entry!`);
            let obj = {};
            passwordEntries[filename] = obj;
            await dbInterface.addPair('file-passwords', filename, obj);
            entry = obj;
            console.log(`> Created entry for "${filename}"!`);
        }
        else
        {
            console.log(`> ERROR: File "${filename}" not found!`);
            res.status(404).send("File not found");
            return;
        }
    }

    if (entry["hash"])
        entry = {password:entry};
    let downloadFilename = entry["filename"];
    if (!downloadFilename)
        downloadFilename = filename;
    console.log(`> DOWNLOAD FILENAME \"${downloadFilename}\"`);

    let entryPW = entry["password"];
    if (!entryPW)
        entryPW = {};

    if (entryPW.salt != undefined && entryPW.hash != undefined)
    {
        let cookies = req.cookies;
        if (cookies === undefined)
        {
            console.log(`> ERROR: No cookies found!`);
            res.redirect(`/password/password.html?file=${filename}&error=No%20cookies`);
            return;
        }
        if (cookies["passwords"] === undefined)
        {
            console.log(`> ERROR: No passwords found!`);
            res.redirect(`/password/password.html?file=${filename}&error=No%20passwords`);
            return;
        }
        try {
            let passwords = JSON.parse(cookies["passwords"]);

            let password = passwords[filename];
            if (password === undefined)
            {
                console.log(`> ERROR: No password found!`);
                res.redirect(`/password/password.html?file=${filename}&error=No%20password`);
                return;
            }

            if (await securityInterface.checkPassword(password, entryPW.salt, entryPW.hash))
            {
                let filePath = filesFolder + filename;
                filePath = resolve(filePath);
                console.log(`> Sending file "${filePath}")`)

                //res.sendFile(filePath);
                res.download(filePath, downloadFilename);
                return;
            }
            else
            {
                console.log(`> ERROR: Invalid password!`);
                res.redirect(`/password/password.html?file=${filename}&error=Invalid%20password`);
                return;
            }
        }
        catch (e)
        {
            console.log(`> ERROR: Invalid passwords!`);
            res.redirect(`/password/password.html?file=${filename}&error=Invalid%20passwords`);
            return;
        }
    }
    else
    {
        let filePath = filesFolder + filename;
        filePath = resolve(filePath);
        console.log(`> Sending passwordless file "${filePath}")`)

        //res.sendFile(filePath);
        res.download(filePath, downloadFilename);
    }
}

module.exports = {initApp, sendFile};