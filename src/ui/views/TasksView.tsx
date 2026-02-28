import { useState } from "react";

import * as React from "react";
import type { Task } from "../../core/domain/task";

interface TasksViewProps {
  tasks: ReadonlyArray<Task>;
  onCreateTask: (input: {
    title: string;
    description?: string;
    scheduledFor?: Date;
    dueAt?: Date;
    projectId?: string;
  }) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onCompleteTask: (taskId: string) => void;
  onDeferTask: (taskId: string, until: Date) => void;
  onRescheduleTask: (taskId: string, nextAt: Date) => void;
  filters?: { status?: Task["status"]; projectId?: string };
  onFilterChange?: (filters: { status?: Task["status"]; projectId?: string }) => void;
  projects?: ReadonlyArray<{ id: string; name: string }>;
}

const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

const formatDateForInput = (date: Date | undefined): string => {
  if (!date) return "";
  return date.toISOString().split("T")[0];
};

const getTaskStatusClass = (status: Task["status"]): string => {
  switch (status) {
    case "completed":
      return "status-completed";
    case "deferred":
      return "status-deferred";
    default:
      return "status-planned";
  }
};

export function TasksView({
  tasks,
  onCreateTask,
  onUpdateTask,
  onCompleteTask,
  onDeferTask,
  onRescheduleTask,
  filters,
  onFilterChange,
  projects,
}: TasksViewProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    scheduledFor: "",
    dueAt: "",
    projectId: "",
  });
  const [editForm, setEditForm] = useState<Partial<Task>>({});

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;

    onCreateTask({
      title: createForm.title,
      description: createForm.description || undefined,
      scheduledFor: createForm.scheduledFor ? new Date(createForm.scheduledFor) : undefined,
      dueAt: createForm.dueAt ? new Date(createForm.dueAt) : undefined,
      projectId: createForm.projectId || undefined,
    });

    setCreateForm({ title: "", description: "", scheduledFor: "", dueAt: "", projectId: "" });
    setIsCreating(false);
  };

  const handleEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForm({ ...task });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId) return;

    onUpdateTask(editingTaskId, editForm);
    setEditingTaskId(null);
    setEditForm({});
  };

  const handleDefer = (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onDeferTask(taskId, tomorrow);
  };

  const handleReschedule = (taskId: string) => {
    const now = new Date();
    onRescheduleTask(taskId, now);
  };

  const handleFilterStatusChange = (status: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      status: status ? (status as Task["status"]) : undefined,
    });
  };

  const handleFilterProjectChange = (projectId: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      projectId: projectId || undefined,
    });
  };

  const groupTasksByStatus = () => {
    const grouped: Record<Task["status"], Task[]> = {
      planned: [],
      completed: [],
      deferred: [],
    };
    tasks.forEach((task) => {
      grouped[task.status].push(task);
    });
    return grouped;
  };

  const groupTasksByProject = () => {
    const grouped: Record<string, Task[]> = {
      none: [],
    };
    projects?.forEach((p) => {
      grouped[p.id] = [];
    });
    tasks.forEach((task) => {
      const key = task.projectId ?? "none";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  };

  const groupedByStatus = groupTasksByStatus();
  const groupedByProject = groupTasksByProject();

  const renderTaskItem = (task: Task) => {
    if (editingTaskId === task.id) {
      return (
        <form key={task.id} className="list-item edit-form" onSubmit={handleEditSubmit}>
          <input
            type="text"
            className="form-input"
            value={editForm.title ?? ""}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            placeholder="Task title"
          />
          <textarea
            className="form-input"
            value={editForm.description ?? ""}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Description"
          />
          <input
            type="date"
            className="form-input"
            value={formatDateForInput(
              editForm.scheduledFor ? new Date(editForm.scheduledFor) : undefined,
            )}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                scheduledFor: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            placeholder="Scheduled for"
          />
          <input
            type="date"
            className="form-input"
            value={formatDateForInput(editForm.dueAt ? new Date(editForm.dueAt) : undefined)}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                dueAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })
            }
            placeholder="Due at"
          />
          <select
            className="form-select"
            value={editForm.projectId ?? ""}
            onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value || undefined })}
          >
            <option value="">No project</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingTaskId(null)}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    return (
      <div key={task.id} className={`list-item ${getTaskStatusClass(task.status)}`}>
        <div className="item-title">{task.title}</div>
        {task.description && <div className="item-description">{task.description}</div>}
        <div className="item-meta">
          <span className={`status-badge ${getTaskStatusClass(task.status)}`}>{task.status}</span>
          {task.projectId && projects && (
            <span className="project-badge">
              {projects.find((p) => p.id === task.projectId)?.name ?? "Unknown"}
            </span>
          )}
          {task.scheduledFor && (
            <span className="date-badge">Scheduled: {formatDateTime(task.scheduledFor)}</span>
          )}
          {task.dueAt && <span className="date-badge">Due: {formatDateTime(task.dueAt)}</span>}
          {task.deferredUntil && (
            <span className="date-badge deferred">
              Deferred until: {formatDateTime(task.deferredUntil)}
            </span>
          )}
          {task.completedAt && (
            <span className="date-badge completed">
              Completed at: {formatDateTime(task.completedAt)}
            </span>
          )}
        </div>
        <div className="item-actions">
          {task.status === "planned" && (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onCompleteTask(task.id)}
              >
                Complete
              </button>
              <button type="button" className="btn-secondary" onClick={() => handleDefer(task.id)}>
                Defer
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleReschedule(task.id)}
              >
                Reschedule
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => handleEditStart(task)}>
            Edit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Tasks</h2>
        <button type="button" className="btn-primary" onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? "Cancel" : "New Task"}
        </button>
      </div>

      {onFilterChange && (
        <div className="filter-bar">
          <select
            className="form-select"
            value={filters?.status ?? ""}
            onChange={(e) => handleFilterStatusChange(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="deferred">Deferred</option>
          </select>
          <select
            className="form-select"
            value={filters?.projectId ?? ""}
            onChange={(e) => handleFilterProjectChange(e.target.value)}
          >
            <option value="">All projects</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isCreating && (
        <form className="create-form" onSubmit={handleCreateSubmit}>
          <input
            type="text"
            className="form-input"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Task title"
            required
          />
          <textarea
            className="form-input"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Description (optional)"
          />
          <input
            type="date"
            className="form-input"
            value={createForm.scheduledFor}
            onChange={(e) => setCreateForm({ ...createForm, scheduledFor: e.target.value })}
            placeholder="Scheduled for"
          />
          <input
            type="date"
            className="form-input"
            value={createForm.dueAt}
            onChange={(e) => setCreateForm({ ...createForm, dueAt: e.target.value })}
            placeholder="Due at"
          />
          <select
            className="form-select"
            value={createForm.projectId}
            onChange={(e) => setCreateForm({ ...createForm, projectId: e.target.value })}
          >
            <option value="">No project</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Create Task
            </button>
          </div>
        </form>
      )}

      <div className="list-container">
        {tasks.length === 0 ? (
          <div className="empty-state">No tasks</div>
        ) : (
          <>
            {!filters?.status && !filters?.projectId && (
              <>
                <h3>By Status</h3>
                {Object.entries(groupedByStatus).map(([status, statusTasks]) =>
                  statusTasks.length > 0 ? (
                    <div key={status} className="group-section">
                      <h4 className="group-title">
                        {status} ({statusTasks.length})
                      </h4>
                      {statusTasks.map(renderTaskItem)}
                    </div>
                  ) : null,
                )}

                <h3>By Project</h3>
                {Object.entries(groupedByProject).map(([projectId, projectTasks]) =>
                  projectTasks.length > 0 ? (
                    <div key={projectId} className="group-section">
                      <h4 className="group-title">
                        {projectId === "none"
                          ? "No project"
                          : projects?.find((p) => p.id === projectId)?.name ?? "Unknown"}
                        ({projectTasks.length})
                      </h4>
                      {projectTasks.map(renderTaskItem)}
                    </div>
                  ) : null,
                )}
              </>
            )}
            {(filters?.status || filters?.projectId) && tasks.map(renderTaskItem)}
          </>
        )}
      </div>
    </div>
  );
}
