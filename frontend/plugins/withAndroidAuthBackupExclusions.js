const fs = require("node:fs/promises");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");

const BACKUP_RULES = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="sharedpref" path="SecureStore"/>
  <exclude domain="database" path="RKStorage"/>
  <exclude domain="database" path="RKStorage-journal"/>
  <exclude domain="database" path="RKStorage-wal"/>
  <exclude domain="database" path="RKStorage-shm"/>
  <exclude domain="database" path="AsyncStorage"/>
  <exclude domain="database" path="AsyncStorage-journal"/>
  <exclude domain="database" path="AsyncStorage-wal"/>
  <exclude domain="database" path="AsyncStorage-shm"/>
</full-backup-content>
`;

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="database" path="RKStorage"/>
    <exclude domain="database" path="RKStorage-journal"/>
    <exclude domain="database" path="RKStorage-wal"/>
    <exclude domain="database" path="RKStorage-shm"/>
    <exclude domain="database" path="AsyncStorage"/>
    <exclude domain="database" path="AsyncStorage-journal"/>
    <exclude domain="database" path="AsyncStorage-wal"/>
    <exclude domain="database" path="AsyncStorage-shm"/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="database" path="RKStorage"/>
    <exclude domain="database" path="RKStorage-journal"/>
    <exclude domain="database" path="RKStorage-wal"/>
    <exclude domain="database" path="RKStorage-shm"/>
    <exclude domain="database" path="AsyncStorage"/>
    <exclude domain="database" path="AsyncStorage-journal"/>
    <exclude domain="database" path="AsyncStorage-wal"/>
    <exclude domain="database" path="AsyncStorage-shm"/>
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withAndroidAuthBackupExclusions(config) {
  return withDangerousMod(config, ["android", async (mod) => {
    const xmlDirectory = path.join(
      mod.modRequest.platformProjectRoot,
      "app",
      "src",
      "main",
      "res",
      "xml",
    );
    await fs.mkdir(xmlDirectory, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(xmlDirectory, "secure_store_backup_rules.xml"), BACKUP_RULES),
      fs.writeFile(path.join(xmlDirectory, "secure_store_data_extraction_rules.xml"), DATA_EXTRACTION_RULES),
    ]);
    return mod;
  }]);
};
