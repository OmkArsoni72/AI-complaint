require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  console.log('MONGODB_URI set:', Boolean(process.env.MONGODB_URI));
  await mongoose.connect(process.env.MONGODB_URI);
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log(cols.map((c) => c.name));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
