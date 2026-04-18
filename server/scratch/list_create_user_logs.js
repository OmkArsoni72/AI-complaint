require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const logs = await mongoose.connection.db
    .collection('auditlogs')
    .find({ action: 'CREATE_USER' })
    .project({ targetId: 1, performedBy: 1, createdAt: 1 })
    .toArray();
  console.log('create_user logs', logs.length);
  console.log(logs.slice(0, 10));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
