    import {
      createApp,
      ref,
      reactive,
      computed,
      watch,
      onMounted,
      onBeforeUnmount,
    } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
    import {
      createPinia,
      storeToRefs,
    } from "https://cdn.jsdelivr.net/npm/pinia@3.0.4/+esm";

    import { cloneTasks, formatMinutes, makeId } from "./helpers.js";
    import { ProfilePanel } from "./components/profile-panel.js";
    import { TaskModal } from "./components/task-modal.js";
    import { useBoardStore } from "./stores/board.js";

    const pinia = createPinia();

    const app = createApp({
      components: { TaskModal, ProfilePanel },
      setup() {
        const boardStore = useBoardStore();
        const {
          columns,
          tasks,
          teammates,
          currentUser,
          currentUserInitials,
          hoveredTaskId,
          selectedTaskIds,
          lastSelectedTaskId,
          textSelectionActive,
          selectedTextContent,
          draggedTaskIds,
          dragOverColumnId,
          hoveredColumnId: columnHoverId,
          activeModalTaskId,
          searchQuery,
          assigneeFilter,
          showOnlyMine,
          profileOpen,
          columnEditorOpen,
          columnDragState,
          hasActiveFilters,
          normalizedSearch,
        } = storeToRefs(boardStore);

        const newTaskTitle = ref("");
        const newTaskColumn = ref(columns.value[0]?.id || "todo");
        const defaultColumnColor = "#6366f1";
        const newColumnTitle = ref("");
        const newColumnColor = ref(defaultColumnColor);
        const contextMenu = reactive({
          open: false,
          x: 0,
          y: 0,
          targetIds: [],
        });

        const resetNewColumnForm = () => {
          newColumnTitle.value = "";
          newColumnColor.value = defaultColumnColor;
        };

        watch(
          columns,
          () => {
            if (!columns.value.find((col) => col.id === newTaskColumn.value)) {
              newTaskColumn.value = columns.value[0]?.id || "";
            }
          },
          { immediate: true }
        );

        const getAssigneeLabel = (assigneeId) =>
          boardStore.getAssigneeLabel(assigneeId);
        const createTask = (payload) => boardStore.createTask(payload);
        const updateTask = (payload) => boardStore.updateTask(payload);
        const moveTask = (payload) => boardStore.moveTask(payload);
        const deleteTask = (payload) => boardStore.deleteTask(payload);
        const addTimeEntryForTask = (taskId, minutes, note = "") =>
          boardStore.addTimeEntryForTask(taskId, minutes, note);
        const addCommentForTask = (taskId, text) =>
          boardStore.addCommentForTask(taskId, text);
        const addColumn = (payload) => boardStore.addColumn(payload);
        const renameColumn = (id, title) => boardStore.renameColumn(id, title);
        const updateColumnColor = (id, color) =>
          boardStore.updateColumnColor(id, color);
        const removeColumn = (id) => boardStore.removeColumn(id);
        const reorderColumn = (id, position) =>
          boardStore.reorderColumn(id, position);
        const setColumnColor = (payload) => boardStore.setColumnColor(payload);
        const assignTaskToMember = (payload) =>
          boardStore.assignTaskToMember(payload);
        const clearTaskAssignee = (payload) =>
          boardStore.clearTaskAssignee(payload);
        const updateProfile = (payload) => boardStore.updateProfile(payload);
        const openProfilePanel = () => {
          boardStore.openProfilePanel();
        };
        const closeProfilePanel = () => boardStore.closeProfilePanel();
        const clearFilters = () => boardStore.clearFilters();
        const setFiltersFromTool = (payload) =>
          boardStore.setFiltersFromTool(payload);

        const matchesFilters = (task) => {
          if (showOnlyMine.value && task.assigneeId !== currentUser.value.id) {
            return false;
          }
          if (assigneeFilter.value === "__unassigned__") {
            if (task.assigneeId) return false;
          } else if (
            assigneeFilter.value &&
            task.assigneeId !== assigneeFilter.value
          ) {
            return false;
          }
          const search = normalizedSearch.value;
          if (search) {
            const haystack = [
              task.title || "",
              task.description || "",
              ...(task.comments || []).map((c) => c.text || ""),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(search)) return false;
          }
          return true;
        };

        const filteredTasks = computed(() =>
          tasks.value.filter((task) => matchesFilters(task))
        );

        const visibleTasksByColumn = computed(() => {
          const map = {};
          columns.value.forEach((col) => {
            map[col.id] = [];
          });
          filteredTasks.value.forEach((task) => {
            if (!map[task.columnId]) {
              map[task.columnId] = [];
            }
            map[task.columnId].push(task);
          });
          return map;
        });

        const getOrderedTaskIds = () => {
          const ordered = [];
          columns.value.forEach((col) => {
            (visibleTasksByColumn.value[col.id] || []).forEach((task) => {
              ordered.push(task.id);
            });
          });
          return ordered;
        };

        const filteredTasksCount = computed(
          () => filteredTasks.value.length
        );

        const totalTimeLogged = computed(() =>
          tasks.value.reduce((sum, task) => sum + (task.totalMinutes || 0), 0)
        );

        const myOpenTasksCount = computed(
          () =>
            tasks.value.filter(
              (task) =>
                task.assigneeId === currentUser.value.id &&
                task.columnId !== "done"
            ).length
        );

        const myCompletedTasksCount = computed(
          () =>
            tasks.value.filter(
              (task) =>
                task.assigneeId === currentUser.value.id &&
                task.columnId === "done"
            ).length
        );

        const myAssignedTasks = computed(() =>
          tasks.value.filter((task) => task.assigneeId === currentUser.value.id)
        );

        const myTasksPreview = computed(() =>
          myAssignedTasks.value.slice(0, 5)
        );

        const doneTasksCount = computed(
          () => tasks.value.filter((task) => task.columnId === "done").length
        );

        const upcomingTasksCount = computed(
          () => tasks.value.length - doneTasksCount.value
        );

        const buildFilterSummary = () => {
          const parts = [];
          if (normalizedSearch.value) {
            parts.push(`search="${normalizedSearch.value}"`);
          }
          if (assigneeFilter.value === "__unassigned__") {
            parts.push("assignee=unassigned");
          } else if (assigneeFilter.value) {
            parts.push(
              `assignee=${getAssigneeLabel(assigneeFilter.value)}`
            );
          }
          if (showOnlyMine.value) {
            parts.push("only my tasks");
          }
          return parts;
        };

        const filterSummaryList = computed(() => buildFilterSummary());

        const profileStats = computed(() => ({
          open: myOpenTasksCount.value,
          closed: myCompletedTasksCount.value,
          totalTime: formatMinutes(totalTimeLogged.value),
          doneColumn: doneTasksCount.value,
        }));

        const updateProfileFromPanel = (payload) => {
          updateProfile(payload);
          closeProfilePanel();
        };

        const ensureNewTaskColumn = () => {
          if (!columns.value.find((col) => col.id === newTaskColumn.value)) {
            newTaskColumn.value = columns.value[0]?.id || "";
          }
        };

        const addColumnFromEditor = () => {
          const title = newColumnTitle.value.trim();
          if (!title) return;
          addColumn({ title, color: newColumnColor.value });
          resetNewColumnForm();
        };

        const clearColumnDragState = () => {
          columnDragState.value = { id: null, overId: null };
        };

        const onColumnDragStart = (id) => {
          columnDragState.value = { ...columnDragState.value, id };
        };

        const onColumnDragEnd = () => {
          clearColumnDragState();
        };

        const onColumnDragHover = (id) => {
          columnDragState.value = { ...columnDragState.value, overId: id };
        };

        const onColumnDragLeaveEditor = (id) => {
          if (columnDragState.value.overId === id) {
            columnDragState.value = { ...columnDragState.value, overId: null };
          }
        };

        const onColumnDrop = (targetId) => {
          const sourceId = columnDragState.value.id;
          if (!sourceId || sourceId === targetId) {
            clearColumnDragState();
            return;
          }
          const targetIndex = columns.value.findIndex(
            (col) => col.id === targetId
          );
          if (targetIndex === -1) {
            clearColumnDragState();
            return;
          }
          reorderColumn(sourceId, targetIndex);
          clearColumnDragState();
        };

        const toggleColumnEditor = () => {
          columnEditorOpen.value = !columnEditorOpen.value;
          resetNewColumnForm();
          clearColumnDragState();
          dragOverColumnId.value = null;
          draggedTaskIds.value = [];
          setHoveredColumn(null);
        };

        const isTaskSelected = (id) => selectedTaskIds.value.includes(id);

        const setSelection = (ids) => {
          const uniqueIds = [...new Set(ids)];
          selectedTaskIds.value = uniqueIds;
          lastSelectedTaskId.value = uniqueIds[uniqueIds.length - 1] || null;
        };

        const toggleTaskSelection = (id) => {
          if (isTaskSelected(id)) {
            setSelection(selectedTaskIds.value.filter((taskId) => taskId !== id));
          } else {
            setSelection([...selectedTaskIds.value, id]);
          }
        };

        const selectRangeTo = (targetId) => {
          const anchor = lastSelectedTaskId.value || targetId;
          const orderedIds = getOrderedTaskIds();
          const start = orderedIds.indexOf(anchor);
          const end = orderedIds.indexOf(targetId);
          if (start === -1 || end === -1) {
            setSelection([targetId]);
            return;
          }
          const [min, max] = start < end ? [start, end] : [end, start];
          setSelection(orderedIds.slice(min, max + 1));
        };

        const onTaskClick = (event, id) => {
          if (event.shiftKey) {
            selectRangeTo(id);
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            toggleTaskSelection(id);
            return;
          }
          setSelection([id]);
          closeContextMenu();
        };

        const activeModalTask = computed(
          () => tasks.value.find((task) => task.id === activeModalTaskId.value) || null
        );

        watch(activeModalTaskId, (taskId) => {
          document.body.classList.toggle("modal-open", Boolean(taskId));
        });

        const getTaskById = (id) =>
          tasks.value.find((task) => task.id === id) || null;

        const openTaskModal = (taskId) => {
          const task = getTaskById(taskId);
          if (!task) return;
          activeModalTaskId.value = taskId;
        };

        const closeTaskModal = () => {
          activeModalTaskId.value = null;
        };

        const handleCreateTask = () => {
          createTask({ title: newTaskTitle.value, columnId: newTaskColumn.value });
          newTaskTitle.value = "";
        };

        const handleTaskMouseEnter = (id) => {
          hoveredTaskId.value = id;
        };

        const handleTaskMouseLeave = () => {
          hoveredTaskId.value = null;
        };

        const closeContextMenu = () => {
          if (!contextMenu.open) return;
          Object.assign(contextMenu, {
            open: false,
            x: 0,
            y: 0,
            targetIds: [],
          });
        };

        const handleGlobalClick = (event) => {
          if (!contextMenu.open) return;
          const menu = document.getElementById("task-context-menu");
          if (menu && menu.contains(event.target)) return;
          closeContextMenu();
        };

        const openContextMenu = (event, taskId) => {
          if (!isTaskSelected(taskId)) {
            setSelection([taskId]);
          }
          const targetIds = [...selectedTaskIds.value];
          const menuWidth = 240;
          const menuHeight = 320;
          const padding = 12;
          const viewportX = event.clientX + window.scrollX;
          const viewportY = event.clientY + window.scrollY;
          const maxX = window.scrollX + window.innerWidth - menuWidth - padding;
          const maxY = window.scrollY + window.innerHeight - menuHeight - padding;
          const x = Math.max(window.scrollX + padding, Math.min(viewportX, maxX));
          const y = Math.max(window.scrollY + padding, Math.min(viewportY, maxY));
          Object.assign(contextMenu, {
            open: true,
            x,
            y,
            targetIds,
          });
        };

        const openSelectedInModal = () => {
          const id = contextMenu.targetIds[0];
          if (id) {
            openTaskModal(id);
          }
          closeContextMenu();
        };

        const moveSelectedToColumn = (columnId) => {
          contextMenu.targetIds.forEach((taskId) => {
            moveTask({ id: taskId, toColumnId: columnId });
          });
          closeContextMenu();
        };

        const assignSelectedTo = (assigneeId) => {
          contextMenu.targetIds.forEach((taskId) => {
            assignTaskToMember({ id: taskId, assigneeId });
          });
          closeContextMenu();
        };

        const duplicateSelectedTasks = () => {
          const clones = contextMenu.targetIds
            .map((taskId) => getTaskById(taskId))
            .filter(Boolean)
            .map((task) => ({
              ...task,
              id: makeId("task"),
              title: `${task.title} (copy)`,
              timeEntries: (task.timeEntries || []).map((entry) => ({
                ...entry,
                id: makeId("time"),
              })),
              comments: (task.comments || []).map((comment) => ({
                ...comment,
                id: makeId("comment"),
              })),
            }));
          tasks.value = [...clones, ...tasks.value];
          boardStore.notifyTasksChanged();
          closeContextMenu();
        };

        const deleteSelectedTasks = () => {
          contextMenu.targetIds.forEach((taskId) =>
            deleteTask({ id: taskId })
          );
          closeContextMenu();
        };

        const clearSelectionAction = () => {
          setSelection([]);
          closeContextMenu();
        };

        const handleTaskDragStart = (id) => {
          if (!isTaskSelected(id)) {
            setSelection([id]);
          }
          draggedTaskIds.value = [...selectedTaskIds.value];
        };

        const handleTaskDragEnd = () => {
          draggedTaskIds.value = [];
          dragOverColumnId.value = null;
        };

        const setHoveredColumn = (id) => {
          boardStore.setHoveredColumn(id);
        };

        const handleColumnDragOver = (columnId) => {
          dragOverColumnId.value = columnId;
          setHoveredColumn(columnId);
        };

        const handleColumnDragLeave = (columnId, event) => {
          const current = event?.currentTarget;
          const related = event?.relatedTarget;
          if (current && related && current.contains(related)) return;
          if (dragOverColumnId.value === columnId) {
            dragOverColumnId.value = null;
          }
          if (
            !draggedTaskIds.value.length &&
            columnHoverId.value === columnId
          ) {
            setHoveredColumn(null);
          }
        };

        const handleColumnDrop = (columnId) => {
          const idsToMove = draggedTaskIds.value.length
            ? draggedTaskIds.value
            : selectedTaskIds.value;
          if (!idsToMove.length) return;
          const ordered = tasks.value
            .filter((task) => idsToMove.includes(task.id))
            .map((task) => task.id);
          ordered.forEach((taskId) => {
            moveTask({ id: taskId, toColumnId: columnId });
          });
          draggedTaskIds.value = [];
          dragOverColumnId.value = null;
          setHoveredColumn(null);
        };

        const addTimeEntryFromModal = ({ minutes, note = "" }) => {
          if (!activeModalTaskId.value) return;
          addTimeEntryForTask(activeModalTaskId.value, minutes, note);
        };

        const addCommentFromModal = ({ text }) => {
          if (!activeModalTaskId.value) return;
          addCommentForTask(activeModalTaskId.value, text);
        };

        const deleteTaskFromModal = ({ id }) => {
          const taskId = id || activeModalTaskId.value;
          if (!taskId) return;
          deleteTask({ id: taskId });
        };

        const setAssigneeFromModal = ({ id, assigneeId }) => {
          const targetId = id || activeModalTaskId.value;
          if (!targetId) return;
          assignTaskToMember({ id: targetId, assigneeId });
        };

        const exportBoardState = () => ({
          columns: columns.value.map((col) => ({ ...col })),
          tasks: cloneTasks(tasks.value),
          filteredTasks: cloneTasks(filteredTasks.value),
          hoveredTaskId: hoveredTaskId.value,
          selectedTaskIds: [...selectedTaskIds.value],
          textSelectionActive: textSelectionActive.value,
          selectedText: selectedTextContent.value,
          activeModalTaskId: activeModalTaskId.value,
          teammates: teammates.value.map((member) => ({ ...member })),
          currentUser: { ...currentUser.value },
          filters: {
            searchQuery: normalizedSearch.value,
            assigneeFilter: assigneeFilter.value,
            showOnlyMine: showOnlyMine.value,
          },
        });

        const getToolDetail = (event) => (event && event.detail) || {};

        // Profile tools
        const handleToolOpenProfile = (event) => {
          try {
            openProfilePanel();
          } catch (err) {
            console.error('VOIX tool "open_profile_panel" failed', err);
          }
        };

        const handleToolCloseProfile = (event) => {
          try {
            closeProfilePanel();
          } catch (err) {
            console.error('VOIX tool "close_profile_panel" failed', err);
          }
        };

        const handleToolUpdateProfile = (event) => {
          try {
            const detail = getToolDetail(event);
            updateProfile(detail || {});
          } catch (err) {
            console.error('VOIX tool "update_profile" failed', err);
          }
        };

        // Filter tools
        const handleToolSetFilters = (event) => {
          try {
            const detail = getToolDetail(event);
            setFiltersFromTool({
              searchQuery: detail.searchQuery,
              assigneeId: detail.assigneeId,
              showOnlyMine: detail.showOnlyMine,
            });
          } catch (err) {
            console.error('VOIX tool "set_filters" failed', err);
          }
        };

        const handleToolClearFilters = (event) => {
          try {
            clearFilters();
          } catch (err) {
            console.error('VOIX tool "clear_filters" failed', err);
          }
        };

        // Column tools
        const handleToolAddColumn = (event) => {
          try {
            const detail = getToolDetail(event);
            const id = addColumn(detail || {});
            if (id) {
              event?.target?.dispatchEvent(
                new CustomEvent("return", { detail: { id } })
              );
            }
          } catch (err) {
            console.error('VOIX tool "add_column" failed', err);
          }
        };

        const handleToolRenameColumn = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id, title } = detail;
            if (!id || typeof title !== "string") return;
            renameColumn(id, title);
          } catch (err) {
            console.error('VOIX tool "rename_column" failed', err);
          }
        };

        const handleToolRemoveColumn = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id } = detail;
            if (!id) return;
            removeColumn(id);
          } catch (err) {
            console.error('VOIX tool "remove_column" failed', err);
          }
        };

        const handleToolReorderColumn = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id, position } = detail;
            if (!id || typeof position !== "number") return;
            reorderColumn(id, position);
          } catch (err) {
            console.error('VOIX tool "reorder_column" failed', err);
          }
        };

        const handleToolSetColumnColor = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id, color } = detail;
            if (!id || !color) return;
            setColumnColor({ id, color });
          } catch (err) {
            console.error('VOIX tool "set_column_color" failed', err);
          }
        };

        // Board tools
        const handleToolGetBoardState = (event) => {
          try {
            if (event?.target) {
              event.target.dispatchEvent(
                new CustomEvent("return", { detail: exportBoardState() })
              );
            }
          } catch (err) {
            console.error('VOIX tool "get_board_state" failed', err);
          }
        };

        // Task tools
        const handleToolCreateTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const { title, description = "", columnId, assigneeId } = detail;
            if (!title) return;
            createTask({ title, description, columnId, assigneeId });
          } catch (err) {
            console.error('VOIX tool "create_task" failed', err);
          }
        };

        const handleToolUpdateTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id, title, description, columnId, assigneeId } = detail;
            if (!id) return;
            updateTask({ id, title, description, columnId, assigneeId });
          } catch (err) {
            console.error('VOIX tool "update_task" failed', err);
          }
        };

        const handleToolMoveTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id, toColumnId, position } = detail;
            if (!id || !toColumnId) return;
            moveTask({ id, toColumnId, position });
          } catch (err) {
            console.error('VOIX tool "move_task" failed', err);
          }
        };

        const handleToolDeleteTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id } = detail;
            if (!id) return;
            deleteTask({ id });
          } catch (err) {
            console.error('VOIX tool "delete_task" failed', err);
          }
        };

        const handleToolOpenTaskModal = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id } = detail;
            if (!id) return;
            openTaskModal(id);
          } catch (err) {
            console.error('VOIX tool "open_task_modal" failed', err);
          }
        };

        const handleToolAddTimeEntry = (event) => {
          try {
            const detail = getToolDetail(event);
            const { taskId, minutes, note = "" } = detail;
            if (!taskId || typeof minutes === "undefined") return;
            addTimeEntryForTask(taskId, minutes, note);
          } catch (err) {
            console.error('VOIX tool "add_time_entry" failed', err);
          }
        };

        const handleToolAddComment = (event) => {
          try {
            const detail = getToolDetail(event);
            const { taskId, text } = detail;
            if (!taskId || !text) return;
            addCommentForTask(taskId, text);
          } catch (err) {
            console.error('VOIX tool "add_comment" failed', err);
          }
        };

        const handleToolAssignTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const id = detail.id || detail.taskId;
            const assigneeId = detail.assigneeId;
            if (!id) return;
            assignTaskToMember({ id, assigneeId });
          } catch (err) {
            console.error('VOIX tool "assign_task" failed', err);
          }
        };

        const handleToolUnassignTask = (event) => {
          try {
            const detail = getToolDetail(event);
            const { id } = detail;
            if (!id) return;
            clearTaskAssignee({ id });
          } catch (err) {
            console.error('VOIX tool "unassign_task" failed', err);
          }
        };

        const handleSelectionChange = () => {
          const sel = document.getSelection ? document.getSelection() : null;
          const active =
            sel &&
            !sel.isCollapsed &&
            typeof sel.toString === "function" &&
            sel.toString().trim().length > 0;
          if (active) {
            const snippet = sel.toString().trim().slice(0, 280);
            selectedTextContent.value = snippet;
            textSelectionActive.value = true;
          } else {
            selectedTextContent.value = "";
            textSelectionActive.value = false;
          }
        };

        const handleKeyDown = (event) => {
          if (event.key === "Escape") {
            if (contextMenu.open) {
              closeContextMenu();
              return;
            }
            if (activeModalTaskId.value) {
              closeTaskModal();
              return;
            }
            if (profileOpen.value) {
              closeProfilePanel();
            }
          }
        };

        onMounted(() => {
          document.addEventListener("selectionchange", handleSelectionChange);
          document.addEventListener("keydown", handleKeyDown);
          document.addEventListener("click", handleGlobalClick);
          handleSelectionChange();
        });

        onBeforeUnmount(() => {
          document.removeEventListener("selectionchange", handleSelectionChange);
          document.removeEventListener("keydown", handleKeyDown);
          document.removeEventListener("click", handleGlobalClick);
        });

        return {
          columns,
          tasks,
          newTaskTitle,
          newTaskColumn,
          handleCreateTask,
          visibleTasksByColumn,
          formatMinutes,
          getAssigneeLabel,
          openTaskModal,
          onTaskClick,
          isTaskSelected,
          handleTaskMouseEnter,
          handleTaskMouseLeave,
          handleTaskDragStart,
          handleTaskDragEnd,
          handleColumnDragOver,
          handleColumnDragLeave,
          handleColumnDrop,
          dragOverColumnId,
          activeModalTask,
          closeTaskModal,
          addTimeEntryFromModal,
          addCommentFromModal,
          deleteTaskFromModal,
          setAssigneeFromModal,
          updateTask,
          teammates,
          currentUser,
          currentUserInitials,
          searchQuery,
          assigneeFilter,
          showOnlyMine,
          profileOpen,
          columnEditorOpen,
          hasActiveFilters,
          clearFilters,
          filteredTasksCount,
          myOpenTasksCount,
          myCompletedTasksCount,
          doneTasksCount,
          upcomingTasksCount,
          totalTimeLogged,
          profileStats,
          myTasksPreview,
          filterSummaryList,
          hoveredTaskId,
          columnHoverId,
          textSelectionActive,
          selectedTextContent,
          assignTaskToMember,
          clearTaskAssignee,
          addColumn,
          renameColumn,
          removeColumn,
          reorderColumn,
          setColumnColor,
          updateColumnColor,
          addColumnFromEditor,
          newColumnTitle,
          newColumnColor,
          toggleColumnEditor,
          columnDragState,
          onColumnDragStart,
          onColumnDragEnd,
          onColumnDrop,
          onColumnDragHover,
          onColumnDragLeaveEditor,
          contextMenu,
          openContextMenu,
          closeContextMenu,
          openSelectedInModal,
          moveSelectedToColumn,
          assignSelectedTo,
          duplicateSelectedTasks,
          deleteSelectedTasks,
          clearSelectionAction,
          updateProfile,
          updateProfileFromPanel,
          openProfilePanel,
          closeProfilePanel,
          exportBoardState,
          selectedTaskIds,
          setSelection,
          toggleTaskSelection,
          selectRangeTo,
          handleToolOpenProfile,
          handleToolCloseProfile,
          handleToolUpdateProfile,
          handleToolSetFilters,
          handleToolClearFilters,
          handleToolAddColumn,
          handleToolRenameColumn,
          handleToolRemoveColumn,
          handleToolReorderColumn,
          handleToolSetColumnColor,
          handleToolGetBoardState,
          handleToolCreateTask,
          handleToolUpdateTask,
          handleToolMoveTask,
          handleToolDeleteTask,
          handleToolOpenTaskModal,
          handleToolAddTimeEntry,
          handleToolAddComment,
          handleToolAssignTask,
          handleToolUnassignTask,
          setHoveredColumn,
        };
      },
    });

    app.config.compilerOptions.isCustomElement = (tag) => ["context", "tool", "prop", "array"].includes(tag)

    app.use(pinia);
    app.mount("#app");
