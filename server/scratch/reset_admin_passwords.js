require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mapping = {
  'water@gmail.com': 'water@123',
  'social@gmail.com': 'social@123',
  'government@gmail.com': 'government@123',
  'education@gmail.com': 'education@123',
  'anti@gmail.com': 'anti@123',
  'municipal@gmail.com': 'municipal@123',
  'health@gmail.com': 'health@123',
  'pwd@gmail.com': 'pwd@123',
  'bep@gmail.com': 'bep@123',
};

const escape = (value) => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
const emailRegexes = Object.keys(mapping).map((email) => new RegExp(`^${escape(email)}$`, 'i'));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const users = await mongoose.connection.db
      .collection('users')
      .find({ email: { $in: emailRegexes } })
      .project({ email: 1 })
      .toArray();

    for (const user of users) {
      const emailLower = (user.email || '').toLowerCase();
      const pwd = mapping[emailLower];
      if (!pwd) continue;

      const hashed = await bcrypt.hash(pwd, 10);
      await mongoose.connection.db.collection('users').updateOne(
        { _id: user._id },
        { $set: { plainPassword: pwd, password: hashed, isActive: true } }
      );
    }

    console.log('updated', users.length, 'users');
    console.log(users.map((u) => u.email));
    await mongoose.disconnect();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
