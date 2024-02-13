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

async function uploadFile(file, pass)
{
    console.log("Uploading file: ", file);
    let filename = file.name;
    let reader = new FileReader();
    let data;
    try {
        data = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    catch (e)
    {
        return {error: "Failed to read file"};
    }

    let fileObj = {"filename":filename, "data":data};
    if (pass != undefined)
        fileObj["password"] = pass;

    let reply = await msgSendAndGetReply("upload", fileObj);
    if (reply["error"] != undefined)
        return {error: reply["error"]};
    console.log("RES: ", reply);

    return {url: reply["url"]};
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

        let res = await uploadFile(file, pass);
        if (res["error"] != undefined)
        {
            fLink.textContent = "Error: " + res["error"];
            fLink.href = "#";
        }
        else
        {
            fLink.textContent = "Uploaded!";
            fLink.href = res["url"];
        }
    }
}