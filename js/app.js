    import {
      createApp,
      ref,
      reactive,
      computed,
      watch,
      onMounted,
      onBeforeUnmount,
      nextTick,
    } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
    import {
      createPinia,
      storeToRefs,
    } from "https://cdn.jsdelivr.net/npm/pinia@3.0.4/+esm";

    import { cloneTasks, formatMinutes, makeId } from "./helpers.js";
    import { ProfilePanel } from "./components/profile-panel.js";
    import { TaskModal } from "./components/task-modal.js";
    import { VoixToolbelt } from "./components/voix-toolbelt.js";
    import { useBoardStore } from "./stores/board.js";

    const pinia = createPinia();

    const app = createApp({
      components: { TaskModal, ProfilePanel, VoixToolbelt },
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
        const contextMenu = reactive({
          open: false,
          x: 0,
          y: 0,
          targetIds: [],
        });

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
        const openProfilePanel = () => {boardStore.openProfilePanel();}
        const closeProfilePanel = () => boardStore.closeProfilePanel();
        const clearFilters = () => boardStore.clearFilters();
        const setFiltersFromTool = (payload) =>
          boardStore.setFiltersFromTool(payload);
        const clearFiltersFromTool = () => boardStore.clearFilters();

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

        const addColumnInteractive = () => {
          addColumn();
        };

        const onColumnDragStart = (id) => {
          columnDragState.value.id = id;
        };

        const onColumnDragEnd = () => {
          columnDragState.value.id = null;
        };

        const onColumnDrop = (targetId) => {
          const sourceId = columnDragState.value.id;
          if (!sourceId || sourceId === targetId) return;
          const targetIndex = columns.value.findIndex(
            (col) => col.id === targetId
          );
          if (targetIndex === -1) return;
          reorderColumn(sourceId, targetIndex);
          columnDragState.value.id = null;
        };

        const toggleColumnEditor = () => {
          columnEditorOpen.value = !columnEditorOpen.value;
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

        const taskContextEntries = computed(() =>
          tasks.value.map((task) => {
            const assignee = getAssigneeLabel(task.assigneeId);
            const timeEntries = Array.isArray(task.timeEntries)
              ? task.timeEntries
              : [];
            const comments = Array.isArray(task.comments) ? task.comments : [];
            const columnInfo = columns.value.find(
              (col) => col.id === task.columnId
            );
            const lines = [];
            lines.push(`Task ID: ${task.id}`);
            lines.push(`Title: ${task.title}`);
            lines.push(
              `Description: ${task.description || "No description provided."}`
            );
            lines.push(`Column: ${columnInfo ? columnInfo.title : task.columnId}`);
            lines.push(`Assignee: ${assignee}`);
            if (timeEntries.length) {
              lines.push("Time entries:");
              timeEntries.forEach((entry, index) => {
                lines.push(
                  `  ${index + 1}. ${formatMinutes(entry.minutes)} — ${
                    entry.note || "No note"
                  } @ ${new Date(entry.createdAt).toLocaleString()}`
                );
              });
            } else {
              lines.push("Time entries: none");
            }
            if (comments.length) {
              lines.push("Comments:");
              comments.forEach((comment, index) => {
                lines.push(
                  `  ${index + 1}. "${comment.text}" @ ${new Date(
                    comment.createdAt
                  ).toLocaleString()}`
                );
              });
            } else {
              lines.push("Comments: none");
            }
            return {
              id: task.id,
              name: `task_${task.id}`,
              taskId: task.id,
              text: lines.join("\n"),
            };
          })
        );

        const columnsContextText = computed(() => {
          const lines = [];
          lines.push("Columns configuration");
          const filterParts = buildFilterSummary();
          lines.push(
            `Active filters: ${
              filterParts.length ? filterParts.join(", ") : "none"
            }`
          );
          columns.value.forEach((col, index) => {
            const count = tasks.value.filter(
              (task) => task.columnId === col.id
            ).length;
            lines.push(
              `${index + 1}. [${col.id}] "${col.title}" – Tasks: ${count}; Color: ${
                col.color || "default"
              }`
            );
          });
          return lines.join("\n");
        });

        const assignmentsContextText = computed(() => {
          const lines = [];
          lines.push("Assignments overview");
          lines.push("");
          lines.push(
            `Current user: ${currentUser.value.name} (${currentUser.value.role})`
          );
          lines.push("");
          teammates.value.forEach((member) => {
            const memberTasks = tasks.value.filter(
              (task) => task.assigneeId === member.id
            );
            lines.push(
              `- ${member.name} (${member.role}) - ${memberTasks.length} task(s)`
            );
            memberTasks.forEach((task) => {
              lines.push(
                `  - ${task.title} [${task.id}] in column "${task.columnId}"`
              );
            });
            lines.push("");
          });
          const unassigned = tasks.value.filter((task) => !task.assigneeId);
          lines.push(`Unassigned tasks (${unassigned.length}):`);
          unassigned.forEach((task) => {
            lines.push(`  - ${task.title} [${task.id}]`);
          });
          return lines.join("\n");
        });

        const interactionContextText = computed(() => {
          const hovered =
            hoveredTaskId.value == null
              ? "none"
              : `task with id "${hoveredTaskId.value}"`;
          const selectedCount = selectedTaskIds.value.length;
          let selectedDescription = "none";
          if (selectedCount === 1) {
            selectedDescription = `task with id "${selectedTaskIds.value[0]}"`;
          } else if (selectedCount > 1) {
            selectedDescription = `${selectedCount} tasks (${selectedTaskIds.value.join(
              ", "
            )})`;
          }
          const modalState = activeModalTaskId.value
            ? `open for task "${activeModalTaskId.value}"`
            : "closed";
          const selectionText = textSelectionActive.value
            ? selectedTextContent.value.replace(/\s+/g, " ").trim()
            : "";
          const selection = textSelectionActive.value
            ? `yes - "${selectionText}"`
            : "no";

          const lines = [];
          lines.push(
            "Interaction state. When the user asks for deictic prompts, use this info to understand them. I.e. if the user says 'this task' while selecting or hoving over a task, refer to that task."
          );
          lines.push("");
          lines.push(
            `Mouse hovering over task: ${hoveredTaskId.value ? "yes" : "no"} (${hovered})`
          );
          lines.push(`Selected tasks: ${selectedDescription}`);
          lines.push(`Task detail modal: ${modalState}`);
          lines.push(`Any text selected in page: ${selection}`);
          return lines.join("\n");
        });

        const profileContextText = computed(() => {
          const lines = [];
          lines.push(
            `Signed in as ${currentUser.value.name} (${currentUser.value.role})`
          );
          lines.push(`Status: ${currentUser.value.status}`);
          lines.push(`Email: ${currentUser.value.email}`);
          lines.push(`My open tasks: ${myOpenTasksCount.value}`);
          lines.push(`My completed tasks: ${myCompletedTasksCount.value}`);
          const filterParts = buildFilterSummary();
          lines.push(
            `Filters active: ${
              filterParts.length ? filterParts.join(", ") : "none"
            }`
          );
          return lines.join("\n");
        });

        const boardSummaryContextText = computed(() => {
          const lines = [];
          lines.push("Kanban board summary");
          const filterParts = buildFilterSummary();
          lines.push(
            `Active filters: ${
              filterParts.length ? filterParts.join(", ") : "none"
            }`
          );
          lines.push(`Total logged time: ${formatMinutes(totalTimeLogged.value)}`);
          lines.push(`Tasks on board: ${tasks.value.length}`);
          lines.push(`Visible tasks after filters: ${filteredTasks.value.length}`);
          return lines.join("\n");
        });

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

        const handleColumnDragOver = (columnId) => {
          if (!draggedTaskIds.value.length) return;
          dragOverColumnId.value = columnId;
        };

        const handleColumnDragLeave = (columnId, event) => {
          if (!draggedTaskIds.value.length) return;
          const current = event?.currentTarget;
          const related = event?.relatedTarget;
          if (current && related && current.contains(related)) return;
          if (dragOverColumnId.value === columnId) {
            dragOverColumnId.value = null;
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
          setFiltersFromTool,
          clearFiltersFromTool,
          filteredTasksCount,
          myOpenTasksCount,
          myCompletedTasksCount,
          doneTasksCount,
          upcomingTasksCount,
          totalTimeLogged,
          profileStats,
          myTasksPreview,
          filterSummaryList,
          taskContextEntries,
          columnsContextText,
          assignmentsContextText,
          interactionContextText,
          profileContextText,
          boardSummaryContextText,
          assignTaskToMember,
          clearTaskAssignee,
          addColumn,
          renameColumn,
          removeColumn,
          reorderColumn,
          setColumnColor,
          updateColumnColor,
          addColumnInteractive,
          toggleColumnEditor,
          onColumnDragStart,
          onColumnDragEnd,
          onColumnDrop,
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
          createTask,
          updateTask,
          moveTask,
          deleteTask,
          addTimeEntryForTask,
          addCommentForTask,
          exportBoardState,
          selectedTaskIds,
          setSelection,
          toggleTaskSelection,
          selectRangeTo,
        };
      },
    });

    app.config.compilerOptions.isCustomElement = (tag) => ["context", "tool", "prop", "array"].includes(tag)

    app.use(pinia);
    app.mount("#app");
