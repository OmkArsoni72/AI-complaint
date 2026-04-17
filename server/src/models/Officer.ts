import mongoose, { Schema, Document } from 'mongoose';

export interface IOfficer extends Document {
  name: string;
  department: string;
  departmentId: mongoose.Types.ObjectId | null;
  designation: string;
  rank: string;
  level: number;
  region: string;
  email: string;
  phone: string;
  userId: mongoose.Types.ObjectId | null;
  employeeId: string;
  officeAddress: string;
  district: string;
  state: string;
  pincode: string;
  pendingCount: number;
  escalatedCount: number;
  resolvedCount: number;
  performance: number;
  isActive: boolean;
}

const OfficerSchema = new Schema<IOfficer>(
  {
    name: { type: String, required: true },
    department: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    designation: { type: String, required: true },
    rank: { type: String, default: 'Officer' },
    level: { type: Number, default: 1 },
    region: { type: String, default: 'Delhi-NCR' },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    employeeId: { type: String, default: '' },
    officeAddress: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    pendingCount: { type: Number, default: 0 },
    escalatedCount: { type: Number, default: 0 },
    resolvedCount: { type: Number, default: 0 },
    performance: { type: Number, default: 75 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IOfficer>('Officer', OfficerSchema);
