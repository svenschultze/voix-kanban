import { ref, watchEffect } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

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
    const createTool = ref(null);
    const updateTool = ref(null);
    const moveTool = ref(null);
    const deleteTool = ref(null);
    const stateTool = ref(null);
    const timeTool = ref(null);
    const commentTool = ref(null);
    const openTool = ref(null);
    const assignTool = ref(null);
    const unassignTool = ref(null);
    const filtersTool = ref(null);
    const clearFiltersTool = ref(null);
    const openProfileTool = ref(null);
    const closeProfileTool = ref(null);
    const updateProfileTool = ref(null);
    const addColumnTool = ref(null);
    const renameColumnTool = ref(null);
    const removeColumnTool = ref(null);
    const reorderColumnTool = ref(null);
    const setColumnColorTool = ref(null);

    const register = (elRef, handler) => {
      watchEffect((onCleanup) => {
        const el = elRef.value;
        if (!el) return;
        const listener = async (event) => {
          try {
            await handler(event);
          } catch (err) {
            const toolName = el.getAttribute("name") || "unknown_tool";
            console.error(`VOIX tool "${toolName}" failed`, err);
          }
        };
        el.addEventListener("call", listener);
        onCleanup(() => el.removeEventListener("call", listener));
      });
    };

    register(createTool, (event) => {
      const detail = event.detail || {};
      const { title, description = "", columnId, assigneeId } = detail;
      if (!title) return;
      props.createTask({ title, description, columnId, assigneeId });
    });

    register(updateTool, (event) => {
      const detail = event.detail || {};
      const { id, title, description, columnId, assigneeId } = detail;
      if (!id) return;
      props.updateTask({ id, title, description, columnId, assigneeId });
    });

    register(moveTool, (event) => {
      const detail = event.detail || {};
      const { id, toColumnId, position } = detail;
      if (!id || !toColumnId) return;
      props.moveTask({ id, toColumnId, position });
    });

    register(deleteTool, (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.deleteTask({ id });
    });

    register(stateTool, (event) => {
      const payload = props.getBoardState();
      event.target.dispatchEvent(
        new CustomEvent("return", { detail: payload })
      );
    });

    register(timeTool, (event) => {
      const detail = event.detail || {};
      const { id, minutes, note = "" } = detail;
      if (!id || typeof minutes === "undefined") return;
      props.addTimeEntry(id, minutes, note);
    });

    register(commentTool, (event) => {
      const detail = event.detail || {};
      const { id, text } = detail;
      if (!id || !text) return;
      props.addComment(id, text);
    });

    register(openTool, (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.openTaskModal(id);
    });

    register(assignTool, (event) => {
      const detail = event.detail || {};
      console.log("[assign_tool] call", detail);
      const id = detail.id || detail.taskId;
      const assigneeId = detail.assigneeId;
      if (!id) {
        console.warn("[assign_tool] missing id/taskId");
        return;
      }
      props.assignTask({ id, assigneeId });
    });

    register(unassignTool, (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.clearAssignee({ id });
    });

    register(filtersTool, (event) => {
      const detail = event.detail || {};
      props.setFilters({
        searchQuery: detail.searchQuery,
        assigneeId: detail.assigneeId,
        showOnlyMine: detail.showOnlyMine,
      });
    });

    register(clearFiltersTool, () => {
      props.clearFilters();
    });

    register(openProfileTool, () => {
      props.openProfile();
    });

    register(closeProfileTool, () => {
      props.closeProfile();
    });

    register(updateProfileTool, (event) => {
      const detail = event.detail || {};
      props.updateProfile(detail || {});
    });

    register(addColumnTool, (event) => {
      const detail = event.detail || {};
      const id = props.addColumn(detail || {});
      if (id) {
        event.target.dispatchEvent(
          new CustomEvent("return", { detail: { id } })
        );
      }
    });

    register(renameColumnTool, (event) => {
      const detail = event.detail || {};
      const { id, title } = detail;
      if (!id || typeof title !== "string") return;
      props.renameColumn(id, title);
    });

    register(removeColumnTool, (event) => {
      const detail = event.detail || {};
      const { id } = detail;
      if (!id) return;
      props.removeColumn(id);
    });

    register(reorderColumnTool, (event) => {
      const detail = event.detail || {};
      const { id, position } = detail;
      if (!id || typeof position !== "number") return;
      props.reorderColumn(id, position);
    });

    register(setColumnColorTool, (event) => {
      const detail = event.detail || {};
      const { id, color } = detail;
      if (!id || !color) return;
      props.setColumnColor({ id, color });
    });

    return {
      createTool,
      updateTool,
      moveTool,
      deleteTool,
      stateTool,
      timeTool,
      commentTool,
      openTool,
      assignTool,
      unassignTool,
      filtersTool,
      clearFiltersTool,
      openProfileTool,
      closeProfileTool,
      updateProfileTool,
      addColumnTool,
      renameColumnTool,
      removeColumnTool,
      reorderColumnTool,
      setColumnColorTool,
    };
  },
  template: `
    <section aria-hidden="true">
      <tool ref="createTool" name="create_task" description="Create a new kanban task">
        <prop name="title" type="string" required></prop>
        <prop name="description" type="string"></prop>
        <prop
          name="columnId"
          type="string"
          description="Column ID: todo | in-progress | done"
          required
        ></prop>
      </tool>

      <tool ref="updateTool" name="update_task" description="Update an existing kanban task">
        <prop name="id" type="string" required></prop>
        <prop name="title" type="string"></prop>
        <prop name="description" type="string"></prop>
        <prop
          name="columnId"
          type="string"
          description="Optional new column ID"
        ></prop>
      </tool>

      <tool ref="moveTool" name="move_task" description="Move a task to another column and position">
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

      <tool ref="deleteTool" name="delete_task" description="Delete a task from the board">
        <prop name="id" type="string" required></prop>
      </tool>

      <tool
        ref="stateTool"
        name="get_board_state"
        description="Return current columns, tasks and interaction state"
        return
      ></tool>

      <tool ref="timeTool" name="add_time_entry" description="Log time for a task">
        <prop name="id" type="string" description="Task ID" required></prop>
        <prop
          name="minutes"
          type="number"
          description="Minutes to log (positive integer)"
          required
        ></prop>
        <prop name="note" type="string" description="Optional note"></prop>
      </tool>

      <tool ref="commentTool" name="add_comment" description="Add a comment to a task">
        <prop name="id" type="string" description="Task ID" required></prop>
        <prop name="text" type="string" description="Comment text" required></prop>
      </tool>

      <tool ref="openTool" name="open_task_modal" description="Open the detail modal for a task">
        <prop name="id" type="string" description="Task ID" required></prop>
      </tool>

      <tool
        ref="assignTool"
        name="assign_task"
        description="Assign a task to a teammate"
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
        ref="unassignTool"
        name="unassign_task"
        description="Remove any assignee from a task"
      >
        <prop name="id" type="string" description="Task ID" required></prop>
      </tool>

      <tool
        ref="filtersTool"
        name="set_filters"
        description="Apply kanban board filters"
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
        ref="clearFiltersTool"
        name="clear_filters"
        description="Reset all kanban filters"
      ></tool>

      <tool
        ref="openProfileTool"
        name="open_profile_panel"
        description="Open the profile panel"
      ></tool>

      <tool
        ref="closeProfileTool"
        name="close_profile_panel"
        description="Close the profile panel"
      ></tool>

      <tool
        ref="updateProfileTool"
        name="update_profile"
        description="Update the signed-in profile details"
      >
        <prop name="name" type="string" description="Full name"></prop>
        <prop name="role" type="string" description="Role or title"></prop>
        <prop name="email" type="string" description="Email address"></prop>
        <prop name="status" type="string" description="Status message"></prop>
      </tool>

      <tool
        ref="addColumnTool"
        name="add_column"
        description="Add a new column to the board"
        return
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
        ref="renameColumnTool"
        name="rename_column"
        description="Rename an existing column"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
        <prop name="title" type="string" description="New title" required></prop>
      </tool>

      <tool
        ref="removeColumnTool"
        name="remove_column"
        description="Delete a column and reassign its tasks"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
      </tool>

      <tool
        ref="reorderColumnTool"
        name="reorder_column"
        description="Move a column to a new position"
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
        ref="setColumnColorTool"
        name="set_column_color"
        description="Update a column accent color"
      >
        <prop name="id" type="string" description="Column ID" required></prop>
        <prop name="color" type="string" description="Hex color code" required></prop>
      </tool>
    </section>
  `,
};

