require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const AuditLog = mongoose.connection.db.collection('auditlogs');
  const Users = mongoose.connection.db.collection('users');

  const logs = await AuditLog.find({ action: 'CREATE_USER' }).toArray();
  let updated = 0;

  for (const log of logs) {
    if (!log.targetId || !log.performedBy) continue;
    const res = await Users.updateOne(
      { _id: new mongoose.Types.ObjectId(log.targetId), createdBy: { $in: [null, undefined] } },
      { $set: { createdBy: new mongoose.Types.ObjectId(log.performedBy) } }
    );
    updated += res.modifiedCount || 0;
  }

  console.log('backfilled users:', updated);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
