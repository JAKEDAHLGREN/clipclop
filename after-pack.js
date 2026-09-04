const { execSync } = require("child_process");

exports.default = async function afterPack(context) {
  if (process.platform !== "darwin") return;
  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  console.log(`Ad-hoc signing bundle: ${appPath}`);
  execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: "inherit" });
};