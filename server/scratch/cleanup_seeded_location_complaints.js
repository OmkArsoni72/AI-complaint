require('dotenv').config();
const mongoose = require('mongoose');

const AREAS = [
  'Laxmi Nagar',
  'Dwarka',
  'Saket',
  'Chandni Chowk',
  'Nehru Place',
  'Rohini',
  'Janakpuri',
  'Pitampura',
  'Hauz Khas',
  'ITO',
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const res = await mongoose.connection.db.collection('complaints').deleteMany({
    'location.area': { $in: AREAS },
  });

  console.log('deleted seeded-location complaints:', res.deletedCount || 0);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
