const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const frontendRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [frontendRoot];
config.resolver.nodeModulesPaths = [path.join(frontendRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
