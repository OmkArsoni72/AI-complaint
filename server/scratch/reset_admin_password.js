require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = await bcrypt.hash('law@123', 10);
  const res = await mongoose.connection.db.collection('users').updateOne(
    { email: /^law@gmail.com$/i },
    { $set: { password: hash, plainPassword: 'law@123', isActive: true } }
  );
  console.log('updated:', res.modifiedCount);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
