// utils/logger.js

let sink = null;

export function attachLogger(fn) {
  sink = fn;
}

function write(prefix, args) {

  const msg = `[${prefix}] ${args.join(" ")}`;

  if (sink) {
    sink(msg);
  }
}

export function log(...args) {
  write("INFO", args);
}

export function warn(...args) {
  write("WARN", args);
}

export function error(...args) {
  write("ERR", args);
}
