const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = 'mongodb+srv://ankitroy:Ankit%40123@cluster0.ew8ssjs.mongodb.net/grievance-system?retryWrites=true&w=majority';

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  department: String,
  departmentId: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  isSubDepartment: Boolean,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const email = 'omkarsoni@gmail.com';
  const newPassword = 'test123';

  // Find user
  const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

  if (!user) {
    console.log('❌ User NOT found in DB for email:', email);
    console.log('\n📋 All users in DB:');
    const allUsers = await User.find({}).select('email role isActive department');
    allUsers.forEach(u => console.log(`  - ${u.email} | role: ${u.role} | active: ${u.isActive} | dept: ${u.department}`));
  } else {
    console.log('✅ User found:');
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Active:', user.isActive);
    console.log('  Department:', user.department || 'N/A');
    console.log('  Password hash set:', !!user.password);

    // Test current password
    if (user.password) {
      const matches = await bcrypt.compare(newPassword, user.password);
      console.log(`\n🔑 Password "test123" matches:`, matches);

      if (!matches) {
        console.log('\n🔧 Resetting password to "test123"...');
        user.password = await bcrypt.hash(newPassword, 10);
        user.isActive = true;
        await user.save();
        console.log('✅ Password reset done! Try logging in now.');
      } else {
        console.log('\n✅ Password is correct. Issue might be elsewhere.');
        // Make sure user is active
        if (!user.isActive) {
          user.isActive = true;
          await user.save();
          console.log('✅ Also activated the user account.');
        }
      }
    } else {
      console.log('\n🔧 No password set. Setting "test123"...');
      user.password = await bcrypt.hash(newPassword, 10);
      user.isActive = true;
      await user.save();
      console.log('✅ Password set! Try logging in now.');
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch(console.error);
