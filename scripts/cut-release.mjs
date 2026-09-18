#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const bump = (process.argv[2] || "patch").toLowerCase();
if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: node scripts/cut-release.mjs [patch|minor|major]");
  process.exit(1);
}

const pkgPath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map((n) => Number(n));
if ([major, minor, patch].some((n) => Number.isNaN(n))) {
  console.error(`Bad package.json version: ${pkg.version}`);
  process.exit(1);
}

let next;
if (bump === "major") next = `${major + 1}.0.0`;
else if (bump === "minor") next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const tag = `v${next}`;
execFileSync("git", ["add", "package.json"], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", `Release ${tag}`], { stdio: "inherit" });
execFileSync("git", ["tag", "-a", tag, "-m", `Release ${tag}`], { stdio: "inherit" });
execFileSync("git", ["push", "origin", "HEAD", tag], { stdio: "inherit" });
execFileSync(
  "gh",
  ["release", "create", tag, "--title", tag, "--generate-notes"],
  { stdio: "inherit" },
);

console.log(`Released ${tag}. Promote the staged main deployment in Vercel if you have not already.`);
