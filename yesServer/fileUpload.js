let app;
let io;
let accountInterface;
let securityInterface;
let sessionSystem;
let dbInterface;
let fs = require('fs');
const filesFolder = "./data/files/";
let urlBase = "http://localhost/file/";
const resolve = require('path').resolve;

let passwordEntries;

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
    //await dbInterface.addPair('file-passwords', 'test', 'test');
    passwordEntries = await dbInterface._getTable('file-passwords');


    io.on("connection", (socket) => {
        socket.on("upload", async (file) => {

            let session = sessionSystem.getSessionBySocket(socket);
            if (session === undefined)
                return socket.emit({ message: "invalid session" });

            if (file === undefined || file.filename === undefined || file.data === undefined)
                return socket.emit({ message: "invalid file/data" });
            if (file.password != undefined && typeof file.password !== "string")
                return socket.emit({ message: "invalid password type" });

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

            if (file.password != undefined)
            {
                let obj = await securityInterface.hashPassword(file.password);
                passwordEntries[newFilename] = obj;
                dbInterface.addPair('file-passwords', newFilename, obj);
            }
            else
            {
                let obj = {};
                passwordEntries[newFilename] = obj;
                dbInterface.addPair('file-passwords', newFilename, obj);
            }

            console.log(`> UPLOAD DONE TO "${urlBase+newFilename}"!`);

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

async function sendFile(req, res, filename)
{
    let entry = passwordEntries[filename];
    if (entry === undefined)
    {
        console.log(`> ERROR: File "${filename}" not found!`);
        res.status(404).send("File not found");
        return;
    }
    console.log(`> File "${filename}" found: `, entry);
    if (entry.salt != undefined && entry.hash != undefined)
    {
        let cookies = req.cookies;
        console.log(`> RES COOKIES: ${JSON.stringify(cookies)}`);
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
            console.log(passwords);

            let password = passwords[filename];
            if (password === undefined)
            {
                console.log(`> ERROR: No password found!`);
                res.redirect(`/password/password.html?file=${filename}&error=No%20password`);
                return;
            }

            if (await securityInterface.checkPassword(password, entry.salt, entry.hash))
            {
                let filePath = filesFolder + filename;
                filePath = resolve(filePath);
                console.log(`> Sending file "${filePath}")`)

                res.sendFile(filePath);
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

        res.sendFile(filePath);
    }
}

module.exports = {initApp, sendFile};