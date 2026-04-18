require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.db.collection('departments');
  const indexes = await collection.indexes();
  const nameIndex = indexes.find((idx) => idx.name === 'name_1');

  if (nameIndex) {
    await collection.dropIndex('name_1');
    console.log('dropped index: name_1');
  }

  await collection.createIndex(
    { name: 1, parentDepartmentId: 1 },
    { unique: true, name: 'name_1_parentDepartmentId_1' }
  );
  console.log('created index: name_1_parentDepartmentId_1');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
