import { useState } from "react";
import * as React from "react";
import type { Project } from "../../core/domain/project";

interface ProjectsViewProps {
  projects: ReadonlyArray<{ project: Project; taskCount?: number }>;
  onCreateProject: (input: { name: string; description?: string }) => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onSetLifecycle: (projectId: string, lifecycle: Project["lifecycle"]) => void;
  onSelectProject?: (projectId: string) => void;
  filters?: { lifecycle?: Project["lifecycle"] };
  onFilterChange?: (filters: { lifecycle?: Project["lifecycle"] }) => void;
}

const getLifecycleClass = (lifecycle: Project["lifecycle"]): string => {
  switch (lifecycle) {
    case "active":
      return "badge-active";
    case "paused":
      return "badge-paused";
    case "completed":
      return "badge-completed";
    default:
      return "";
  }
};

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString();
};

export function ProjectsView({
  projects,
  onCreateProject,
  onUpdateProject,
  onSetLifecycle,
  onSelectProject,
  filters,
  onFilterChange,
}: ProjectsViewProps): React.ReactElement {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onCreateProject({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      setIsCreating(false);
    }
  };

  const handleEditStart = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDescription(project.description ?? "");
  };

  const handleEditSubmit = (projectId: string) => {
    if (editName.trim()) {
      onUpdateProject(projectId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleLifecycleChange = (projectId: string, lifecycle: Project["lifecycle"]) => {
    onSetLifecycle(projectId, lifecycle);
  };

  const handleFilterChange = (lifecycle: Project["lifecycle"] | undefined) => {
    if (onFilterChange) {
      onFilterChange({ ...filters, lifecycle });
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Projects</h2>
        <div className="view-stats">
          <span>{projects.length} projects</span>
        </div>
      </div>

      {onFilterChange && (
        <div className="filter-bar">
          <label>
            Filter:
            <select
              className="form-input"
              value={filters?.lifecycle ?? ""}
              onChange={(e) =>
                handleFilterChange(
                  e.target.value ? (e.target.value as Project["lifecycle"]) : undefined,
                )
              }
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
      )}

      <div className="list-container">
        {projects.length === 0 ? (
          <div className="empty-state">No projects found</div>
        ) : (
          projects.map(({ project, taskCount }) => (
            <div
              key={project.id}
              className="list-item card"
              onClick={() => onSelectProject?.(project.id)}
              role={onSelectProject ? "button" : undefined}
              tabIndex={onSelectProject ? 0 : undefined}
              onKeyDown={(e) => {
                if (onSelectProject && (e.key === "Enter" || e.key === " ")) {
                  onSelectProject(project.id);
                }
              }}
            >
              {editingId === project.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditSubmit(project.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="edit-form"
                >
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Project name"
                    autoFocus
                  />
                  <textarea
                    className="form-textarea"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="item-header">
                    <h3 className="item-title">{project.name}</h3>
                    <span className={`badge ${getLifecycleClass(project.lifecycle)}`}>
                      {project.lifecycle}
                    </span>
                    {taskCount !== undefined && (
                      <span className="task-count-badge">{taskCount} tasks</span>
                    )}
                  </div>
                  {project.description && (
                    <p className="item-description">{project.description}</p>
                  )}
                  <div className="item-meta">
                    <span className="date-badge">
                      Updated: {formatDate(project.updatedAt)}
                    </span>
                  </div>
                  <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleEditStart(project)}
                    >
                      Edit
                    </button>
                    <select
                      className="form-input lifecycle-select"
                      value={project.lifecycle}
                      onChange={(e) =>
                        handleLifecycleChange(
                          project.id,
                          e.target.value as Project["lifecycle"],
                        )
                      }
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="view-footer">
        {isCreating ? (
          <form onSubmit={handleCreateSubmit} className="create-form card">
            <h3>Create New Project</h3>
            <input
              type="text"
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
            <textarea
              className="form-textarea"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
            />
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsCreating(false);
                  setNewName("");
                  setNewDescription("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-primary create-btn"
            onClick={() => setIsCreating(true)}
          >
            + New Project
          </button>
        )}
      </div>
    </div>
  );
}
