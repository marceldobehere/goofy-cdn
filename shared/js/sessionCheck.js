var sessionId = null;

function setSessionId(newSessionId)
{
    localStorage.setItem("sessionId", JSON.stringify(newSessionId));
    sessionId = newSessionId;
}

async function initSessionCheck()
{
    console.log("> Checking session...");
    sessionId = null;
    try
    {
        let idStr = localStorage.getItem("sessionId");
        if (idStr != null && idStr != undefined)
            sessionId = JSON.parse(idStr);
    }
    catch (e)
    {
        console.log("  > Error parsing sessionId: ", e);
    }

    if (sessionId == null || sessionId == undefined)
    {
        console.log("  > Not logged in");
        setSessionId(null);
        return false;
    }
    else
    {
        let result = await msgSendAndGetReply("get-user", {"sessionId":sessionId});
        if (result["error"] != undefined)
        {
            console.log("Error: ", result["error"]);
            setSessionId(null);
            return false;
        }

        console.log("  > Session works!");
        //setSessionId(sessionId);
        return true;
    }
}