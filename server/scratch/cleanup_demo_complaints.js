require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const demoUsers = await mongoose.connection.db
    .collection('users')
    .find({ email: /@demo\.com$/i })
    .project({ _id: 1 })
    .toArray();

  const ids = demoUsers.map((u) => u._id.toString());
  const res = await mongoose.connection.db
    .collection('complaints')
    .deleteMany({ userId: { $in: ids } });

  console.log('deleted demo-user complaints:', res.deletedCount || 0);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
