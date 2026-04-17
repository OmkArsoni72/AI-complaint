const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

const DemoUserSchema = new mongoose.Schema({ email: String });
const ComplaintSchema = new mongoose.Schema({});

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const User = mongoose.model('User', DemoUserSchema);
    const Complaint = mongoose.model('Complaint', ComplaintSchema, 'complaints');

    const complaintsResult = await Complaint.deleteMany({});

    const usersResult = await User.deleteMany({ email: /@demo\.com$/i });

    console.log('Cleanup complete.');
    console.log('Complaints deleted:', complaintsResult.deletedCount || 0);
    console.log('Demo users deleted:', usersResult.deletedCount || 0);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
