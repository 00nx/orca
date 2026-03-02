import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, shell: true }, (err, stdout, stderr) => {
      if (err) reject(stderr || err);
      else resolve(stdout);
    });
  });
}

async function getNextArtifactDir(buildsDir, name) {
  let i = 1;

  while (true) {
    const suffix = String(i).padStart(3, "0");
    const dirName = `${name}00${suffix}-artifact`;
    const full = path.join(buildsDir, dirName);

    if (!fsSync.existsSync(full)) {
      await fs.mkdir(full, { recursive: true });
      return full;
    }

    i++;
  }
}

async function copySrcWithSymlink(srcDir, destDir) {
  const items = await fs.readdir(srcDir);

  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);

    if (item === "node_modules") {
      await fs.symlink(srcPath, destPath, "junction");
      continue;
    }

    const stat = await fs.lstat(srcPath);

    if (stat.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copySrcWithSymlink(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function findExe(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      const found = await findExe(full);
      if (found) return found;
    }

    if (e.isFile() && e.name.endsWith(".exe")) {
      return full;
    }
  }

  return null;
}

export async function buildArtifact(name) {
  if (!name) throw new Error("Name parameter required");

  const root = __dirname;
  const srcDir = path.join(root, "..", "src");
  const buildsDir = path.join(root, "..", "builds");

  await fs.mkdir(buildsDir, { recursive: true });

  // 1. Create temp artifact folder
  const artifactDir = await getNextArtifactDir(buildsDir, name);

  // 2. Copy src contents with node_modules symlink
  await copySrcWithSymlink(srcDir, artifactDir);
// 3. Patch package.json
await patchPackageJson(artifactDir, name);

// 4. Build
await run(`npx electron-builder --win portable`, artifactDir);

// 5. Get built EXE
const exePath = path.join(artifactDir, "dist", `${name}.exe`);

if (!fsSync.existsSync(exePath)) {
  throw new Error("Built EXE not found");
}

  if (!exePath) {
    throw new Error("Built EXE not found");
  }

  // 5. Final destination
  const finalDir = path.join(buildsDir, name);
  await fs.mkdir(finalDir, { recursive: true });

  const finalExe = path.join(finalDir, `${name}.exe`);

  await fs.copyFile(exePath, finalExe);

  // 6. Cleanup temp artifact folder
  await fs.rm(artifactDir, { recursive: true, force: true });

  console.log("✔ Build complete:", finalExe);
  return finalExe;
}

async function patchPackageJson(artifactDir, name) {
  const pkgPath = path.join(artifactDir, "package.json");

  const raw = await fs.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw);

  const exeName = `${name}.exe`;

  // ---------- ROOT ----------
  pkg.name = name.toLowerCase();
  pkg.productName = name;
  pkg.description = name;   // ⭐ added
  pkg.author ??= "unknown"; // optional safety

  // ---------- BUILD ----------
  pkg.build ??= {};
  pkg.build.win ??= {};

  pkg.build.productName = name;
  pkg.build.artifactName = exeName;

  // ---------- WINDOWS ----------
  pkg.build.win.target = "portable";
  pkg.build.win.executableName = name;
  pkg.build.win.artifactName = exeName;

  // Remove conflicting fields
  delete pkg.build.win.publish;
  delete pkg.build.nsis;

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
}
// Self-run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2];

  buildArtifact(name).catch(err => {
    console.error(err);
    process.exit(1);
  });
}