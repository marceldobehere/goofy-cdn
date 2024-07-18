(async () => {
    if (!await initSessionCheck())
    {
        goPage("/login");
        return;
    }
})().then(() => {console.log("> Done!")});

async function doLogout()
{
    let result = await msgSendAndGetReply("logout", {"sessionId": sessionId});
    if (result["error"] != undefined)
    {
        alert("Error: " + result["error"])
        return;
    }

    setSessionId(null);
    goPage("/login")
}

const fileList = document.getElementById("file-list");
function clearFileList()
{
    fileList.innerHTML = "";
}
clearFileList();


const logLock = false;

class AsyncLock {
    constructor () {
        this.promiseArr = [];
        this.resolveArr = [];
    }

    disable ()
    {
        if (this.resolveArr.length > 0)
        {
            if (logLock)
                console.log("Disabling lock");

            this.promiseArr.shift();
            this.resolveArr.shift()();
        }
        else
            alert("Invalid lock disable")
    }

    async enable ()
    {
        if (logLock)
            console.log("Enabling lock");

        let tempPromises = [];
        for (let prom of this.promiseArr)
            tempPromises.push(prom);
        let bigPromise = Promise.all(tempPromises);

        let resolve;
        let promise = new Promise(r => resolve = r);
        this.promiseArr.push(promise);
        this.resolveArr.push(resolve);

        await bigPromise;
    }

    reset()
    {
        this.promiseArr = [];
        this.resolveArr = [];
    }

    async tryEnable ()
    {
        if (logLock)
            console.log("Trying to enable lock");

        if (this.resolveArr.length > 0)
            return false;

        await this.enable();
        return true;
    }
}
const lockUpload = new AsyncLock();



async function uploadFile(file, pass, element)
{
    await lockUpload.enable();
    try {
        console.log("Uploading file: ", file);
        let filename = file.name;

        // instead of reading the whole file, we read it chunk by chunk and upload each chunk
        // this way we can handle large files
        // and also log the progress
        // first we send a message to \"start-upload\" with the filename, size and password
        // then we send a message to \"upload\" with the chunk data (the chunks are 4MB)
        // we keep sending chunks until we reach the end of the file
        // at the last chunk we get the url of the uploaded file

        // Prep file object
        let fileObj = {"filename":filename, "size": file.size};
        if (pass != undefined)
            fileObj["password"] = pass;

        // Send the start-upload message
        let startUploadReply = await msgSendAndGetReply("start-upload", fileObj);
        if (startUploadReply["error"] != undefined) {
            lockUpload.disable();
            return {error: startUploadReply["error"]};
        }
        let id = startUploadReply["id"];
        let chunkSize = startUploadReply["chunkSize"];
        console.log("> Start upload reply: ", startUploadReply);

        // Read the file in chunks and send them
        let reader = new FileReader();
        let chunkIndex = 0;
        let chunkCount = Math.ceil(file.size / chunkSize);

        // Upload chunks
        let lastReply = undefined;
        while (chunkIndex < chunkCount)
        {
            element.textContent = `Uploading... ${Math.round((10000*chunkIndex) / chunkCount) / 100}%`;
            let start = chunkIndex * chunkSize;
            let end = Math.min(start + chunkSize, file.size);
            let data = file.slice(start, end);
            let chunkData;
            try {
                chunkData = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(data);
                });
            } catch (e) {
                element.textContent = "Error: " + e;
                lockUpload.disable();
                return {error: e};
            }
            // console.log(`> Chunk ${chunkIndex}: ${end}/${file.size} -> ${chunkData.byteLength} bytes`);

            let reply = await msgSendAndGetReply("do-upload", {"id": id, "chunkIndex": chunkIndex, "data": chunkData});
            if (reply["error"] != undefined) {
                lockUpload.disable();
                return {error: reply["error"]};
            }
            //console.log("> Chunk upload reply: ", reply);
            lastReply = reply;

            chunkIndex++;
        }

        if (lastReply == undefined) {
            lockUpload.disable();
            return {error: "No reply from server"};
        }

        console.log("> Last reply: ", lastReply);

        lockUpload.disable();
        return {url: lastReply["url"]};
    } catch (e) {
        lockUpload.disable();
        throw e;
    }
    lockUpload.disable();
}

async function upload(files, pass) {
    if (files.length === 0)
        return alert('No files selected!');
    for (let i = 0; i < files.length; i++)
    {
        let file = files[i];
        console.log(file);
        let listEntry = document.createElement("li");
        fileList.appendChild(listEntry);
        let fName = document.createElement("span");
        listEntry.appendChild(fName);
        let spacer = document.createElement("span");
        listEntry.appendChild(spacer);
        let fLink = document.createElement("a");
        listEntry.appendChild(fLink);

        fName.textContent = `"${file.name}"`;
        spacer.textContent = " -> ";
        fLink.textContent = "Uploading...";
        fLink.href = "/";

        let res = await uploadFile(file, pass, fLink);
        console.log("> Upload res:", res);
        if (res["error"] != undefined)
        {
            fLink.textContent = "Error: " + res["error"];
            fLink.href = "#";
        }
        else
        {
            fLink.textContent = "Uploaded! ";
            fLink.href = res["url"];
        }
    }
}

async function uploadPassword()
{
    let input = prompt('Enter Password');
    if (input == null || input === "")
        return;
    await upload(file_upload.files, input);
}
