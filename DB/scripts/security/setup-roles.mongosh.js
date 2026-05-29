/* =====================================================================
 * NOVS-CMR  -  SECURITY CONFIGURATION (database-level RBAC)
 *
 * Creates MongoDB custom roles, service/human user accounts, and the
 * privileges that back the application's role model. These are MongoDB
 * *authentication* roles - distinct from the application `roles`
 * collection (which drives in-app authorization).
 *
 * Run:
 *   mongosh "mongodb://127.0.0.1:27017/novs_cmr" scripts/security/setup-roles.mongosh.js
 *
 * NOTE: creating users does nothing until access control is turned on.
 * To ENFORCE auth (Windows):
 *   1) Stop service:   net stop MongoDB        (Admin PowerShell)
 *   2) Edit C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg, add:
 *        security:
 *          authorization: enabled
 *   3) Start service:  net start MongoDB
 *   4) Reconnect with one of the users below, e.g.:
 *        mongosh "mongodb://novs_app:ChangeMe_App_2026@127.0.0.1:27017/novs_cmr?authSource=novs_cmr"
 * ===================================================================== */

const dbName = 'novs_cmr';
db = db.getSiblingDB(dbName);

print('\n=== NOVS-CMR :: configuring database security on "' + dbName + '" ===\n');

function dropRoleIfExists(name) {
  try {
    db.dropRole(name);
    print('  [drop role] ' + name);
  } catch (e) {
    /* role did not exist */
  }
}
function dropUserIfExists(name) {
  try {
    if (db.getUser(name)) {
      db.dropUser(name);
      print('  [drop user] ' + name);
    }
  } catch (e) {
    /* user did not exist */
  }
}

const C = (c) => ({ db: dbName, collection: c });

/* ---------------------------------------------------------------------
 * Custom roles (least privilege per electoral function)
 * ------------------------------------------------------------------- */

// 1. Application service account - the Node.js backend connects as this.
dropRoleIfExists('novsAppRole');
db.createRole({
  role: 'novsAppRole',
  privileges: [
    {
      resource: { db: dbName, collection: '' }, // all collections
      actions: ['find', 'insert', 'update', 'remove', 'createIndex'],
    },
  ],
  roles: [],
});
print('  [role] novsAppRole (readWrite on all collections)');

// 2. Registration officer - voters + facial verification only.
dropRoleIfExists('registrationOfficerRole');
db.createRole({
  role: 'registrationOfficerRole',
  privileges: [
    { resource: C('voters'), actions: ['find', 'insert', 'update'] },
    { resource: C('facial_verifications'), actions: ['find', 'insert'] },
    { resource: C('polling_stations'), actions: ['find'] },
    { resource: C('electoral_districts'), actions: ['find'] },
  ],
  roles: [],
});
print('  [role] registrationOfficerRole');

// 3. Electoral admin - elections, candidates, results.
dropRoleIfExists('electoralAdminRole');
db.createRole({
  role: 'electoralAdminRole',
  privileges: [
    { resource: C('elections'), actions: ['find', 'insert', 'update'] },
    { resource: C('candidates'), actions: ['find', 'insert', 'update'] },
    { resource: C('results'), actions: ['find', 'insert', 'update'] },
    { resource: C('blockchain_records'), actions: ['find', 'insert'] },
    { resource: C('voters'), actions: ['find'] },
  ],
  roles: [],
});
print('  [role] electoralAdminRole');

// 4. Audit reviewer - read-only on logs and blockchain refs.
dropRoleIfExists('auditReviewerRole');
db.createRole({
  role: 'auditReviewerRole',
  privileges: [
    { resource: C('audit_logs'), actions: ['find'] },
    { resource: C('blockchain_records'), actions: ['find'] },
    { resource: C('results'), actions: ['find'] },
  ],
  roles: [],
});
print('  [role] auditReviewerRole');

/* ---------------------------------------------------------------------
 * Users (passwords are placeholders - change before any real deployment)
 * ------------------------------------------------------------------- */
function ensureUser(user, pwd, roles) {
  dropUserIfExists(user);
  db.createUser({ user, pwd, roles });
  print('  [user] ' + user + ' -> ' + roles.map((r) => r.role).join(', '));
}

ensureUser('novs_app', 'ChangeMe_App_2026', [
  { role: 'novsAppRole', db: dbName },
]);
ensureUser('officer_reg', 'ChangeMe_Reg_2026', [
  { role: 'registrationOfficerRole', db: dbName },
]);
ensureUser('admin_electoral', 'ChangeMe_Adm_2026', [
  { role: 'electoralAdminRole', db: dbName },
]);
ensureUser('auditor', 'ChangeMe_Aud_2026', [
  { role: 'auditReviewerRole', db: dbName },
]);

print('\nDefined database roles:');
printjson(db.runCommand({ rolesInfo: 1, showBuiltinRoles: false }).roles.map((r) => r.role));
print('\nUsers in ' + dbName + ':');
printjson(db.getUsers().users.map((u) => ({ user: u.user, roles: u.roles })));

print('\n=== security configuration complete ===');
print('Remember: enable authorization in mongod.cfg to ENFORCE these roles.\n');
