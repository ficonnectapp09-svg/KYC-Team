import React, { useEffect, useState } from 'react';
import { CheckSquare, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { TaskItem, Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';

export const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    department: (user?.department === 'Overall' ? 'KYC Team' : (user?.department || 'KYC Team')) as string,
    assignedToEmployeeId: '',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await apiFetch<TaskItem[]>('/tasks');
      if (res.success) {
        setTasks(res.data || []);
      } else {
        setLoadError((res as any).message || 'Failed to load tasks.');
      }

      if (user?.role.includes('lead')) {
        const sRes = await apiFetch<Employee[]>('/staff');
        if (sRes.success) setStaff((sRes.data || []).filter(s => s.status === 'active'));
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load operational tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = staff.find(s => s.employeeId === form.assignedToEmployeeId);
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          assignedToName: targetEmp?.name || 'Department Staff',
          assignedToRole: targetEmp?.role || 'staff'
        })
      });
      setShowCreateModal(false);
      await loadTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await apiFetch(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      await loadTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isLead = user?.role.includes('lead');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Task Allocation & Operations Tracking
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track cross-department assignments, KYC-to-Payment routed onboarding tasks, and operational SLAs.
          </p>
        </div>

        {isLead && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Task</span>
          </button>
        )}
      </div>

      <ErrorBanner message={loadError} onRetry={loadTasks} />

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No Tasks Assigned" icon={CheckSquare} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => (
            <div
              key={task._id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-indigo-600">{task.taskId}</span>
                  <Badge variant={task.priority === 'Urgent' || task.priority === 'High' ? 'danger' : 'info'}>
                    {task.priority}
                  </Badge>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{task.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line">{task.description}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Assignee:</span>
                  <span className="font-semibold">{task.assignedTo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-indigo-600">{task.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status:</span>
                  <select
                    value={task.status}
                    onChange={e => handleStatusChange(task.taskId, e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[11px]"
                  >
                    <option value="Assigned">Assigned</option>
                    <option value="Accepted">Accepted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Submitted for Review">Submitted for Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Assign Operational Task" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <input
            type="text"
            required
            placeholder="Task Title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <textarea
            rows={3}
            placeholder="Instructions / SLA Requirements"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.department}
              disabled={user?.role !== 'overall_lead'}
              onChange={e => setForm({ ...form, department: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            >
              <option value="KYC Team">KYC Team</option>
              <option value="Payment Team">Payment Team</option>
              <option value="Queries Team">Queries Team</option>
            </select>
            <select
              required
              value={form.assignedToEmployeeId}
              onChange={e => setForm({ ...form, assignedToEmployeeId: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            >
              <option value="">-- Assignee --</option>
              {staff.map(s => (
                <option key={s.employeeId} value={s.employeeId}>{s.name} ({s.department})</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
              <option value="Urgent">Urgent</option>
            </select>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">Assign Task</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
