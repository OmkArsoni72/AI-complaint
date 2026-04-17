import mongoose, { Schema, Document } from 'mongoose';

export interface IRank {
  name: string;
  level: number;
}

export interface IDepartment extends Document {
  name: string;
  parentDepartmentId: mongoose.Types.ObjectId | null;
  type: string;
  icon: string;
  location: string;
  jurisdictionLevel: string;
  categories: string[];
  hierarchy: IRank[];
  address: string;
  pincode: string;
  state: string;
  governmentId: string;
  contactEmail: string;
  adminUserId: mongoose.Types.ObjectId | null;
  isActive: boolean;
}

const RankSchema = new Schema<IRank>({
  name: { type: String, required: true },
  level: { type: Number, required: true },
});

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true },
    parentDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    type: { type: String, default: 'General' },
    icon: { type: String, default: '🏢' },
    location: { type: String, default: 'Delhi' },
    jurisdictionLevel: { type: String, default: 'City' },
    categories: { type: [String], default: [] },
    hierarchy: { type: [RankSchema], default: [] },
    address: { type: String, default: '' },
    pincode: { type: String, default: '' },
    state: { type: String, default: '' },
    governmentId: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
