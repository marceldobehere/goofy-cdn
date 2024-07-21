let urlParams = new URLSearchParams(window.location.search);
let filename = urlParams.get("file");
if (filename == null)
    goPage("/index");
console.log("File: ", filename);
let errTextSpan = document.getElementById("err_text");
let errText = urlParams.get("error");
if (errText != null)
    errTextSpan.textContent = errText;


function urlEncode(str)
{
    return encodeURIComponent(str);
}

function urlDecode(str)
{
    return decodeURIComponent(str);
}

// will update or set the password for the file
// cookie can be empty or have other passwords in it
// passwords and filenames need to be url encoded
function writePasswordsToCookies(passwords)
{
    document.cookie = `passwords=${urlEncode(JSON.stringify(passwords))};path=/`;
}

function readPasswordsFromCookies()
{
    let cookies = document.cookie;
    let start = cookies.indexOf("passwords=");
    if (start == -1)
        return {};

    start += 10;
    let end = cookies.indexOf(";", start);
    if (end == -1)
        end = cookies.length;

    let passwords = cookies.substring(start, end);
    passwords = urlDecode(passwords);
    return JSON.parse(passwords);
}


function setPasswordInCookie(filename, password)
{
    let passwords = readPasswordsFromCookies();
    passwords[filename] = password;
    writePasswordsToCookies(passwords);
}

function getPasswordFromCookie(filename)
{
    let passwords = readPasswordsFromCookies();
    return passwords[filename];
}

async function openFile()
{
    let password = document.getElementById("input-password").value;
    setPasswordInCookie(filename, password);
    goPage(`/file/${filename}`);
}

let inputPassword = document.getElementById("input-password");
attachOnEnterHandler(inputPassword, openFile);
inputPassword.focus();