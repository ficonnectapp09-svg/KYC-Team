import mongoose, { Document, Schema } from 'mongoose';
import { Department, TaskStatus } from '../config/constants';

export interface ITaskComment {
  authorId: string;
  authorName: string;
  comment: string;
  timestamp: Date;
}

export interface ITaskItem extends Document {
  taskId: string;
  title: string;
  description: string;
  department: Department;
  assignedTo: {
    employeeId: string;
    name: string;
    role: string;
  };
  assignedBy: {
    employeeId: string;
    name: string;
    role: string;
  };
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: TaskStatus;
  dueDate: Date;
  submittedEvidence?: string;
  comments: ITaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskCommentSchema = new Schema<ITaskComment>({
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  comment: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const TaskItemSchema = new Schema<ITaskItem>({
  taskId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  department: { type: String, enum: Object.values(Department), required: true, index: true },
  assignedTo: {
    employeeId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  assignedBy: {
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },
  status: {
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.ASSIGNED,
    index: true
  },
  dueDate: { type: Date, required: true },
  submittedEvidence: { type: String, default: '' },
  comments: [TaskCommentSchema]
}, {
  timestamps: true,
  collection: 'backoffice_tasks'
});

TaskItemSchema.index({ 'assignedTo.employeeId': 1, status: 1 });

export const TaskItem = mongoose.model<ITaskItem>('backoffice_tasks', TaskItemSchema);

