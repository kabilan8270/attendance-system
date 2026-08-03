const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let backend;
let win;

function startBackend() {
    backend = spawn("node", ["dist/server.js"], {
        cwd: path.join(__dirname, "../backend"),
        shell: true
    });

    backend.stdout.on("data", data => {
        console.log(data.toString());
    });

    backend.stderr.on("data", data => {
        console.log(data.toString());
    });
}

function createWindow() {

    win = new BrowserWindow({
        width: 1400,
        height: 900,
        autoHideMenuBar: true
    });

    setTimeout(() => {
        win.loadURL("http://127.0.0.1:5000");
    }, 4000);
}

app.whenReady().then(() => {
    startBackend();
    createWindow();
});

app.on("window-all-closed", () => {

    if (backend)
        backend.kill();

    app.quit();
});