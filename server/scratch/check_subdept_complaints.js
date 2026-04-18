require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const departments = mongoose.connection.db.collection('departments');
  const complaints = mongoose.connection.db.collection('complaints');

  const parent = await departments.findOne({ name: { $regex: /^Bhilai police$/i } });
  const sub = await departments.findOne({ name: { $regex: /^TI$/i } });

  console.log('parent', parent ? { _id: parent._id.toString(), name: parent.name } : null);
  console.log('sub', sub ? { _id: sub._id.toString(), name: sub.name, parentDepartmentId: sub.parentDepartmentId?.toString?.() || sub.parentDepartmentId } : null);

  if (sub?._id) {
    const list = await complaints.find({
      $or: [
        { assignedSubDepartment: sub._id },
        { departmentId: sub._id },
        { assignedSubDepartmentName: sub.name },
        { department: sub.name },
      ],
    }).project({ complaintId: 1, department: 1, departmentId: 1, assignedSubDepartment: 1, assignedSubDepartmentName: 1 }).toArray();
    console.log('sub complaints', list);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
