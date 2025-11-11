export const VoixToolbelt = {
  name: "VoixToolbelt",
  props: {
    createTask: { type: Function, required: true },
    updateTask: { type: Function, required: true },
    moveTask: { type: Function, required: true },
    deleteTask: { type: Function, required: true },
    addTimeEntry: { type: Function, required: true },
    addComment: { type: Function, required: true },
    openTaskModal: { type: Function, required: true },
    getBoardState: { type: Function, required: true },
    assignTask: { type: Function, required: true },
    clearAssignee: { type: Function, required: true },
    setFilters: { type: Function, required: true },
    clearFilters: { type: Function, required: true },
    openProfile: { type: Function, required: true },
    closeProfile: { type: Function, required: true },
    updateProfile: { type: Function, required: true },
    addColumn: { type: Function, required: true },
    renameColumn: { type: Function, required: true },
    removeColumn: { type: Function, required: true },
    reorderColumn: { type: Function, required: true },
    setColumnColor: { type: Function, required: true },
  },
  setup(props) {
    const invoke = async (name, handler, event) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`VOIX tool "${name}" failed`, err);
      }
    };

    const handleCreate = (event) => {
      const detail = event.detail || {};
      const { title, description = "", columnId, assigneeId } = detail;
      if (!title) return;
      props.createTask({ title, description, columnId, assigneeId });
    };

    const handleUpdate = (event) => {
      const detail = event.detail || {};
      const { id, title, description, columnId, assigneeId } = detail;
      if (!id) return;
      props.updateTask({ id, title, description, columnId, assigneeId });
    };

    const handleMove = (event) => {
      const detail = event.detail || {};
      const { id, toColumnId, position } = detail;
      if (!id || !toColumnId) return;
      props.moveTask({ id, toColumnId, position });
    };

    const handleDelete = (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.deleteTask({ id });
    };

    const handleState = (event) => {
      const payload = props.getBoardState();
      event.target.dispatchEvent(
        new CustomEvent("return", { detail: payload })
      );
    };

    const handleTime = (event) => {
      const detail = event.detail || {};
      const { taskId, minutes, note = "" } = detail;
      if (!taskId || typeof minutes === "undefined") return;
      props.addTimeEntry(taskId, minutes, note);
    };

    const handleComment = (event) => {
      const detail = event.detail || {};
      const { taskId, text } = detail;
      if (!taskId || !text) return;
      props.addComment(taskId, text);
    };

    const handleOpen = (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.openTaskModal(id);
    };

    const handleAssign = (event) => {
      const detail = event.detail || {};
      console.log("[assign_tool] call", detail);
      const id = detail.id || detail.taskId;
      const assigneeId = detail.assigneeId;
      if (!id) {
        console.warn("[assign_tool] missing id/taskId");
        return;
      }
      props.assignTask({ id, assigneeId });
    };

    const handleUnassign = (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.clearAssignee({ id });
    };

    const handleFilters = (event) => {
      const detail = event.detail || {};
      props.setFilters({
        searchQuery: detail.searchQuery,
        assigneeId: detail.assigneeId,
        showOnlyMine: detail.showOnlyMine,
      });
    };

    const handleClearFilters = () => {
      props.clearFilters();
    };

    const handleOpenProfile = () => props.openProfile();
    const handleCloseProfile = () => props.closeProfile();

    const handleUpdateProfile = (event) => {
      const detail = event.detail || {};
      props.updateProfile(detail || {});
    };

    const handleAddColumn = (event) => {
      const detail = event.detail || {};
      const id = props.addColumn(detail || {});
      if (id) {
        event.target.dispatchEvent(
          new CustomEvent("return", { detail: { id } })
        );
      }
    };

    const handleRenameColumn = (event) => {
      const detail = event.detail || {};
      const { id, title } = detail;
      if (!id || typeof title !== "string") return;
      props.renameColumn(id, title);
    };

    const handleRemoveColumn = (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.removeColumn(id);
    };

    const handleReorderColumn = (event) => {
      const detail = event.detail || {};
      const { id, position } = detail;
      if (!id || typeof position !== "number") return;
      props.reorderColumn(id, position);
    };

    const handleSetColumnColor = (event) => {
      const detail = event.detail || {};
      const { id, color } = detail;
      if (!id || !color) return;
      props.setColumnColor({ id, color });
    };

    return {
      invoke,
      handleCreate,
      handleUpdate,
      handleMove,
      handleDelete,
      handleState,
      handleTime,
      handleComment,
      handleOpen,
      handleAssign,
      handleUnassign,
      handleFilters,
      handleClearFilters,
      handleOpenProfile,
      handleCloseProfile,
      handleUpdateProfile,
      handleAddColumn,
      handleRenameColumn,
      handleRemoveColumn,
      handleReorderColumn,
      handleSetColumnColor,
    };
  },
  template: `
    <section aria-hidden="true">
      <tool
        name="create_task"
        description="Create a new kanban task"
        @call="(event) => invoke('create_task', handleCreate, event)"
      >
        <prop name="title" type="string" required></prop>
        <prop name="description" type="string"></prop>
        <prop
          name="columnId"
          type="string"
          description="Column ID: todo | in-progress | done"
          required
        ></prop>
      </tool>

      <tool
        name="update_task"
        description="Update an existing kanban task"
        @call="(event) => invoke('update_task', handleUpdate, event)"
      >
        <prop name="id" type="string" required></prop>
        <prop name="title" type="string"></prop>
        <prop name="description" type="string"></prop>
        <prop
          name="columnId"
          type="string"
          description="Optional new column ID"
        ></prop>
      </tool>

      <tool
        name="move_task"
        description="Move a task to another column and position"
        @call="(event) => invoke('move_task', handleMove, event)"
      >
        <prop name="id" type="string" required></prop>
        <prop
          name="toColumnId"
          type="string"
          description="Target column ID"
          required
        ></prop>
        <prop
          name="position"
          type="number"
          description="Zero-based index in target column (optional)"
        ></prop>
      </tool>

      <tool
        name="delete_task"
        description="Delete a task from the board"
        @call="(event) => invoke('delete_task', handleDelete, event)"
      >
        <prop name="id" type="string" required></prop>
      </tool>

      <tool
        name="get_board_state"
        description="Return current columns, tasks and interaction state"
        return
        @call="(event) => invoke('get_board_state', handleState, event)"
      ></tool>

      <tool
        name="add_time_entry"
        description="Log time for a task"
        @call="(event) => invoke('add_time_entry', handleTime, event)"
      >
        <prop name="taskId" type="string" description="Task ID" required></prop>
        <prop
          name="minutes"
          type="number"
          description="Minutes to log (positive integer)"
          required
        ></prop>
        <prop name="note" type="string" description="Optional note"></prop>
      </tool>

      <tool
        name="add_comment"
        description="Add a comment to a task"
        @call="(event) => invoke('add_comment', handleComment, event)"
      >
        <prop name="taskId" type="string" description="Task ID" required></prop>
        <prop name="text" type="string" description="Comment text" required></prop>
      </tool>

      <tool
        name="open_task_modal"
        description="Open the detail modal for a task"
        @call="(event) => invoke('open_task_modal', handleOpen, event)"
      >
        <prop name="id" type="string" description="Task ID" required></prop>
      </tool>

      <tool
        name="assign_task"
        description="Assign a task to a teammate"
        @call="(event) => invoke('assign_task', handleAssign, event)"
      >
        <prop name="id" type="string" description="Task ID" required></prop>
        <prop
          name="assigneeId"
          type="string"
          description="Teammate ID (e.g., ava, leo, mia, noor)"
          required
        ></prop>
      </tool>

      <tool
        name="unassign_task"
        description="Remove any assignee from a task"
        @call="(event) => invoke('unassign_task', handleUnassign, event)"
      >
        <prop name="id" type="string" description="Task ID" required></prop>
      </tool>

      <tool
        name="set_filters"
        description="Apply kanban board filters"
        @call="(event) => invoke('set_filters', handleFilters, event)"
      >
        <prop
          name="searchQuery"
          type="string"
          description="Search text for title, description, or comments"
        ></prop>
        <prop
          name="assigneeId"
          type="string"
          description="Teammate ID, '__unassigned__', or blank for all"
        ></prop>
        <prop
          name="showOnlyMine"
          type="boolean"
          description="true to show only current user's tasks"
        ></prop>
      </tool>

      <tool
        name="clear_filters"
        description="Reset all kanban filters"
        @call="handleClearFilters"
      ></tool>

      <tool
        name="open_profile_panel"
        description="Open the profile panel"
        @call="handleOpenProfile"
      ></tool>

      <tool
        name="close_profile_panel"
        description="Close the profile panel"
        @call="handleCloseProfile"
      ></tool>

      <tool
        name="update_profile"
        description="Update the signed-in profile details"
        @call="(event) => invoke('update_profile', handleUpdateProfile, event)"
      >
        <prop name="name" type="string" description="Full name"></prop>
        <prop name="role" type="string" description="Role or title"></prop>
        <prop name="email" type="string" description="Email address"></prop>
        <prop name="status" type="string" description="Status message"></prop>
      </tool>

      <tool
        name="add_column"
        description="Add a new column to the board"
        return
        @call="(event) => invoke('add_column', handleAddColumn, event)"
      >
        <prop name="title" type="string" description="Column title"></prop>
        <prop name="color" type="string" description="Hex color like #6366F1"></prop>
        <prop
          name="position"
          type="number"
          description="Zero-based index for column placement"
        ></prop>
      </tool>

      <tool
        name="rename_column"
        description="Rename an existing column"
        @call="(event) => invoke('rename_column', handleRenameColumn, event)"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
        <prop name="title" type="string" description="New title" required></prop>
      </tool>

      <tool
        name="remove_column"
        description="Delete a column and reassign its tasks"
        @call="(event) => invoke('remove_column', handleRemoveColumn, event)"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
      </tool>

      <tool
        name="reorder_column"
        description="Move a column to a new position"
        @call="(event) => invoke('reorder_column', handleReorderColumn, event)"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
        <prop
          name="position"
          type="number"
          description="Zero-based destination index"
          required
        ></prop>
      </tool>

      <tool
        name="set_column_color"
        description="Update a column accent color"
        @call="(event) => invoke('set_column_color', handleSetColumnColor, event)"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
        <prop name="color" type="string" description="Hex color code" required></prop>
      </tool>
    </section>
  `,
};
