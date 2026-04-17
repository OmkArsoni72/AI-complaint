import mongoose, { Schema, Document } from 'mongoose';

export interface ITimelineStep {
  step: string;
  time: Date;
}

export interface IComplaint extends Document {
  complaintId: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  department: string;
  departmentId: mongoose.Types.ObjectId | null;
  slaDeadline: Date;
  resolvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string;
  rejectedBy: string;
  notes: {
    text: string;
    addedBy: string;
    addedAt: Date;
    attachment: string | null;
  }[];
  tags: string[];
  imageUrls: string[];
  voiceNoteUrl: string;
  userId: string;
  userName: string;
  assignedOfficer: string;
  assignedOfficerName: string;
  assignedTo: string;
  feedback: {
    satisfied: boolean;
    comment: string;
    submittedAt: Date;
  };
  timeline: ITimelineStep[];
  location: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
    area: string;
    district: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    complaintId: { type: String, unique: true },
    description: { type: String, required: true },
    category:    { type: String, required: true },
    status:      { type: String, default: 'pending' },
    priority:    { type: String, default: 'MEDIUM' },
    department:  { type: String, default: 'General Administration' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    slaDeadline: { type: Date },
    resolvedAt:  { type: Date, default: null },
    rejectedAt:  { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    rejectedBy: { type: String, default: '' },
    notes: [
      {
        text: { type: String, required: true },
        addedBy: { type: String, required: true },
        addedAt: { type: Date, default: Date.now },
        attachment: { type: String, default: null }
      }
    ],
    tags:        { type: [String], default: [] },
    imageUrls:   { type: [String], default: [] },
    voiceNoteUrl:{ type: String, default: '' },
    userId:      { type: String, default: '' },
    userName:    { type: String, default: 'Anonymous' },
    assignedOfficer: { type: String, default: 'Unassigned' },
    assignedOfficerName: { type: String, default: '' },
    assignedTo: { type: String, default: '' },
    feedback: {
      satisfied: { type: Boolean },
      comment: { type: String },
      submittedAt: { type: Date }
    },
    timeline: [
      {
        step: { type: String, required: true },
        time: { type: Date, default: Date.now }
      }
    ],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      area:     { type: String, required: true },
      district: { type: String, default: 'Delhi' }
    },
  },
  { timestamps: true }
);

// Create geospatial index
ComplaintSchema.index({ location: '2dsphere' });

export default mongoose.model<IComplaint>('Complaint', ComplaintSchema);
