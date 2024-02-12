function goPage(path)
{
    history.pushState({}, "", path);
    window.location.assign(path);
}

function attachOnEnterHandler(element, callback) {
    element.addEventListener('keydown', function(event) {
        if (event.keyCode === 13) {
            callback()
        }
    })
}