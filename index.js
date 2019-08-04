#!/usr/bin/env node

const inquirer = require("inquirer");
const path = require("path");
const fs = require("fs");
const parseGitIgnore = require("parse-gitignore");
const ChildProcess = require("child_process");

const spawn = (command, commandArgs = [], cwd) => {
  ChildProcess.spawn(command, commandArgs, {
    cwd,
    stdio: "inherit"
  });
};

const writeSourceCodeTo = (pathFromGraphiqlToSrc, dirName) => {
  const htmlFile = `
<html lang="en">
  <body>
    <div id="root"></div>
    <script src="./index.tsx"></script>
  </body>
</html>
  `;

  const jsFile = `
import * as React from "react";
import * as ReactDOM from "react-dom";
import GraphiQL from "graphiql";
import { API } from "aws-amplify";
import "graphiql/graphiql.css";

import config from "${pathFromGraphiqlToSrc}aws-exports";
API.configure(config);

ReactDOM.render(
  <GraphiQL fetcher={graphQLParams => API.graphql(graphQLParams)} />,
  document.getElementById("root")
);
  `;
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
  fs.writeFileSync(path.join(dirName, `index.html`), htmlFile);
  fs.writeFileSync(path.join(dirName, `index.tsx`), jsFile);
};

const main = async () => {
  const currentDir = process.cwd();

  const { srcPath } = await inquirer.prompt([
    {
      name: "srcPath",
      default: "./src/",
      type: "input",
      message: "Source Directory Path ( path to aws-exports.js ) : "
    }
  ]);

  const { outPath } = await inquirer.prompt([
    {
      name: "outPath",
      default: "./graphiql/",
      type: "input",
      message: "Graphiql Directory Path ( output code path ) : "
    }
  ]);
  const formattedSrcPath = srcPath.endsWith("/") ? srcPath : `${srcPath}/`;
  const formattedOutPath = outPath.endsWith("/") ? outPath : `${outPath}/`;
  const awsExportsPath = `${formattedSrcPath}aws-exports.js`;
  if (!fs.existsSync(awsExportsPath)) {
    console.log(`Could not find aws-exports.js at ${awsExportsPath}`);
    return;
  }

  const gitIgnorePath = `${currentDir}/.gitignore`;
  const gitignore = fs.existsSync(gitIgnorePath)
    ? parseGitIgnore(fs.readFileSync(gitIgnorePath))
    : [];
  if (gitignore.indexOf(".cache") === -1) {
    fs.appendFileSync(gitIgnorePath, "\n.cache");
  }
  writeSourceCodeTo(
    path.relative(formattedOutPath, formattedSrcPath) + "/",
    formattedOutPath
  );
  ChildProcess.spawnSync("npm", ["init", "-y"], {
    cwd: formattedOutPath
  });
  spawn("npx", ["parcel", "serve", `${formattedOutPath}index.html`]);
  const packageJsonPath = path.join(currentDir, "package.json");
  const packageJsonExists = fs.existsSync(packageJsonPath);
  if (!packageJsonExists) return;

  const currentPackage = require(packageJsonPath);
  const newPackage = {
    ...currentPackage,
    scripts: {
      ...currentPackage.scripts,
      graphiql: `npx parcel ${formattedOutPath}index.html -p 1235`
    }
  };
  fs.writeFileSync(packageJsonPath, JSON.stringify(newPackage, null, 2));
};

main();
