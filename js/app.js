    import {
      createApp,
      ref,
      reactive,
      computed,
      watch,
      watchEffect,
      onMounted,
      onBeforeUnmount,
      nextTick,
      toRefs,
    } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

    import { STORAGE_KEY, defaultColumns, teammates, createDefaultTasks } from "./data.js";
    import { cloneColumns, cloneTasks, formatMinutes, makeId } from "./helpers.js";
    import { ProfilePanel } from "./components/profile-panel.js";
    import { TaskModal } from "./components/task-modal.js";
    import { VoixToolbelt } from "./components/voix-toolbelt.js";

    const currentUser = reactive({
      id: "leo",
      name: "Leo Garcia",
      role: "Frontend Lead",
      email: "leo.garcia@voix.demo",
      status: "Available · Reviewing kanban board",
    });

    const currentUserInitials = computed(() =>
      currentUser.name
        .split(" ")
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    );

    const teammateLookup = teammates.reduce((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, Object.create(null));

    const getAssigneeLabel = (assigneeId) => {
      if (!assigneeId) return "Unassigned";
      const member = teammateLookup[assigneeId];
      return member ? member.name : `Unknown (${assigneeId})`;
    };

    const normalizeAssigneeInput = (input) => {
      if (input == null) return null;
      const text = String(input).trim();
      if (!text || text === "__unassigned__") return null;
      const lowered = text.toLowerCase();
      if (lowered === "current_user" || lowered === "me") {
            return currentUser.id;
      }
      const directMatch = teammates.find(
        (member) =>
          member.id.toLowerCase() === lowered ||
          member.name.toLowerCase() === lowered ||
          (member.email && member.email.toLowerCase() === lowered)
      );
      if (directMatch) return directMatch.id;
      if (teammateLookup[text]) return text;
      return null;
    };

    const loadInitialState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return {
            tasks: createDefaultTasks(),
            columns: cloneColumns(defaultColumns),
          };
        }
        const parsed = JSON.parse(raw);
        return {
          tasks: Array.isArray(parsed?.tasks)
            ? parsed.tasks
            : createDefaultTasks(),
          columns: Array.isArray(parsed?.columns)
            ? cloneColumns(parsed.columns)
            : cloneColumns(defaultColumns),
        };
      } catch (err) {
        console.warn("Failed to parse stored board state, using defaults.", err);
        return {
          tasks: createDefaultTasks(),
          columns: cloneColumns(defaultColumns),
        };
      }
    };

    createApp({
      components: { TaskModal, ProfilePanel, VoixToolbelt },
      setup() {
        const initialState = loadInitialState();
        const columns = ref(cloneColumns(initialState.columns));
        const tasks = ref(initialState.tasks);

        const notifyTasksChanged = () => {
          tasks.value = tasks.value.map((task) => ({ ...task }));
        };
        const newTaskTitle = ref("");
        const newTaskColumn = ref(columns.value[0]?.id || "todo");
        const hoveredTaskId = ref(null);
        const selectedTaskIds = ref([]);
        const lastSelectedTaskId = ref(null);
        const textSelectionActive = ref(false);
        const selectedTextContent = ref("");
        const draggedTaskIds = ref([]);
        const dragOverColumnId = ref(null);
        const activeModalTaskId = ref(null);
        const contextMenu = ref({
          open: false,
          x: 0,
          y: 0,
          targetIds: [],
          submenu: null,
        });

        const searchQuery = ref("");
        const assigneeFilter = ref("");
        const showOnlyMine = ref(false);
        const profileOpen = ref(false);
        const columnEditorOpen = ref(false);
        const columnDragState = ref({ id: null });

        const normalizedSearch = computed(() =>
          searchQuery.value.trim().toLowerCase()
        );

        const matchesFilters = (task) => {
          if (showOnlyMine.value && task.assigneeId !== currentUser.id) {
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
                task.assigneeId === currentUser.id &&
                task.columnId !== "done"
            ).length
        );

        const myCompletedTasksCount = computed(
          () =>
            tasks.value.filter(
              (task) =>
                task.assigneeId === currentUser.id &&
                task.columnId === "done"
            ).length
        );

        const myAssignedTasks = computed(() =>
          tasks.value.filter((task) => task.assigneeId === currentUser.id)
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

        const hasActiveFilters = computed(() =>
          Boolean(
            normalizedSearch.value ||
              assigneeFilter.value ||
              showOnlyMine.value
          )
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

        const updateProfile = ({ name, role, email, status }) => {
          if (typeof name === "string" && name.trim()) {
            currentUser.name = name.trim();
          }
          if (typeof role === "string" && role.trim()) {
            currentUser.role = role.trim();
          }
          if (typeof email === "string" && email.trim()) {
            currentUser.email = email.trim();
          }
          if (typeof status === "string" && status.trim()) {
            currentUser.status = status.trim();
          }
          updateProfileContext();
        };

        const updateProfileFromPanel = (payload) => {
          updateProfile(payload);
          closeProfilePanel();
        };

        const clearFilters = () => {
          searchQuery.value = "";
          assigneeFilter.value = "";
          showOnlyMine.value = false;
        };

        const setFiltersFromTool = ({
          searchQuery: nextSearch,
          assigneeId: nextAssignee,
          showOnlyMine: onlyMine,
        }) => {
          if (typeof nextSearch === "string") {
            searchQuery.value = nextSearch;
          }
          if (typeof nextAssignee !== "undefined") {
            if (
              nextAssignee === "__unassigned__" ||
              nextAssignee === "__UNASSIGNED__"
            ) {
              assigneeFilter.value = "__unassigned__";
            } else if (
              nextAssignee === null ||
              nextAssignee === "" ||
              nextAssignee === "all"
            ) {
              assigneeFilter.value = "";
            } else {
              const normalized = normalizeAssigneeInput(nextAssignee);
              assigneeFilter.value = normalized || "";
            }
          }
          if (typeof onlyMine === "boolean") {
            showOnlyMine.value = onlyMine;
          }
        };

        const clearFiltersFromTool = () => {
          clearFilters();
        };

        const ensureNewTaskColumn = () => {
          if (!columns.value.find((col) => col.id === newTaskColumn.value)) {
            newTaskColumn.value = columns.value[0]?.id || "";
          }
        };

        const accentPalette = [
          "#f97316",
          "#0ea5e9",
          "#10b981",
          "#a855f7",
          "#f43f5e",
          "#14b8a6",
        ];

        const generateColumnId = () =>
          `col-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

        const moveTasksToColumn = (fromId, toId) => {
          if (!toId || fromId === toId) return;
          let changed = false;
          const updated = tasks.value.map((task) => {
            if (task.columnId === fromId) {
              changed = true;
              return { ...task, columnId: toId };
            }
            return task;
          });
          if (changed) {
            tasks.value = updated;
          }
        };

        const addColumn = ({ title, color, position } = {}) => {
          const next = cloneColumns(columns.value);
          const newColumn = {
            id: generateColumnId(),
            title:
              (title || `Column ${next.length + 1}`).trim() ||
              `Column ${next.length + 1}`,
            color: color || accentPalette[next.length % accentPalette.length],
          };
          if (
            typeof position === "number" &&
            position >= 0 &&
            position <= next.length
          ) {
            next.splice(position, 0, newColumn);
          } else {
            next.push(newColumn);
          }
          columns.value = next;
          ensureNewTaskColumn();
          return newColumn.id;
        };

        const addColumnInteractive = () => {
          addColumn();
        };

        const renameColumn = (id, title) => {
          const next = cloneColumns(columns.value);
          const idx = next.findIndex((col) => col.id === id);
          if (idx === -1) return false;
          next[idx].title = (title || "").trim() || "Untitled column";
          columns.value = next;
          return true;
        };

        const updateColumnColor = (id, color) => {
          const next = cloneColumns(columns.value);
          const idx = next.findIndex((col) => col.id === id);
          if (idx === -1) return false;
          next[idx].color = color || accentPalette[idx % accentPalette.length];
          columns.value = next;
          return true;
        };

        const removeColumn = (id) => {
          if (columns.value.length <= 1) return false;
          const next = cloneColumns(columns.value);
          const idx = next.findIndex((col) => col.id === id);
          if (idx === -1) return false;
          next.splice(idx, 1);
          const fallbackId = next[0]?.id;
          if (fallbackId) {
            moveTasksToColumn(id, fallbackId);
            if (newTaskColumn.value === id) {
              newTaskColumn.value = fallbackId;
            }
          }
          columns.value = next;
          ensureNewTaskColumn();
          return true;
        };

        const reorderColumn = (id, toIndex) => {
          const next = cloneColumns(columns.value);
          const fromIndex = next.findIndex((col) => col.id === id);
          if (fromIndex === -1) return false;
          const target = Math.min(Math.max(toIndex, 0), next.length - 1);
          const [moved] = next.splice(fromIndex, 1);
          next.splice(target, 0, moved);
          columns.value = next;
          return true;
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

        const setColumnColor = ({ id, color }) => updateColumnColor(id, color);

        const toggleColumnEditor = () => {
          columnEditorOpen.value = !columnEditorOpen.value;
        };

        const openProfilePanel = () => {
          profileOpen.value = true;
        };

        const closeProfilePanel = () => {
          profileOpen.value = false;
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

        const persistState = () => {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                tasks: cloneTasks(tasks.value),
                columns: cloneColumns(columns.value),
              })
            );
          } catch (err) {
            console.warn("Unable to persist board state.", err);
          }
        };

        const updateTasksContext = () => {
          const root = document.getElementById("kanban-task-contexts");
          if (!root) return;
          const seen = new Set();
          const filterParts = buildFilterSummary();
          tasks.value.forEach((task) => {
            const contextId = `task-context-${task.id}`;
            let ctx = root.querySelector(`context[data-task-id="${task.id}"]`);
            if (!ctx) {
              ctx = document.createElement("context");
              ctx.setAttribute("name", `task_${task.id}`);
              ctx.dataset.taskId = task.id;
              root.appendChild(ctx);
            }
            seen.add(ctx);
            const assignee = getAssigneeLabel(task.assigneeId);
            const totalMinutes = task.totalMinutes || 0;
            const timeEntries =
              task.timeEntries && task.timeEntries.length
                ? task.timeEntries
                : [];
            const comments = task.comments && task.comments.length
              ? task.comments
              : [];
            const lines = [];
            lines.push(`Task ID: ${task.id}`);
            lines.push(`Title: ${task.title}`);
            lines.push(`Description: ${task.description || "No description provided."}`);
            const columnInfo = columns.value.find((col) => col.id === task.columnId);
            lines.push(`Column: ${columnInfo ? columnInfo.title : task.columnId}`);
            lines.push(`Assignee: ${assignee}`);
            lines.push(`Active filters: ${filterParts.length ? filterParts.join(", ") : "none"}`);
            lines.push(`Total logged time: ${formatMinutes(totalMinutes)}`);
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
            ctx.textContent = lines.join("\n");
          });
          root.querySelectorAll("context").forEach((ctx) => {
            if (!seen.has(ctx)) {
              ctx.remove();
            }
          });
        };

        const updateColumnsContext = () => {
          const ctx = document.getElementById("kanban-columns-context");
          if (!ctx) return;
          const lines = [];
          lines.push("Columns configuration");
          const filterParts = buildFilterSummary();
          lines.push(
            `Active filters: ${filterParts.length ? filterParts.join(", ") : "none"}`
          );
          columns.value.forEach((col, index) => {
            const count = tasks.value.filter((task) => task.columnId === col.id).length;
            lines.push(
              `${index + 1}. [${col.id}] "${col.title}" – Tasks: ${count}; Color: ${
                col.color || "default"
              }`
            );
          });
          ctx.textContent = lines.join("\n");
        };

        const updateAssignmentsContext = () => {
          const ctx = document.getElementById("kanban-assignments-context");
          if (!ctx) return;
          const lines = [];
          lines.push("Assignments overview");
          lines.push("");
          lines.push(`Current user: ${currentUser.name} (${currentUser.role})`);
          lines.push("");
          teammates.forEach((member) => {
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
          ctx.textContent = lines.join("\n");
        };

        const updateInteractionContext = () => {
          const ctx = document.getElementById("kanban-interaction-context");
          if (!ctx) return;
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
            "Interaction state. When the user asks for deictic prompts, use this info to understand them. I.e. if the user says 'this task' while hoving over a task, refer to that task."
          );
          lines.push("");
          lines.push(
            `Mouse hovering over task: ${hoveredTaskId.value ? "yes" : "no"} (${hovered})`
          );
          lines.push(`Selected tasks: ${selectedDescription}`);
          lines.push(`Task detail modal: ${modalState}`);
          lines.push(`Any text selected in page: ${selection}`);
          ctx.textContent = lines.join("\n");
        };

        const updateProfileContext = () => {
          const ctx = document.getElementById("kanban-profile-context");
          if (!ctx) return;
          const lines = [];
          lines.push(
            `Signed in as ${currentUser.name} (${currentUser.role})`
          );
          lines.push(`Status: ${currentUser.status}`);
          lines.push(`Email: ${currentUser.email}`);
          lines.push(`My open tasks: ${myOpenTasksCount.value}`);
          lines.push(`My completed tasks: ${myCompletedTasksCount.value}`);
          const filterParts = buildFilterSummary();
          lines.push(
            `Filters active: ${
              filterParts.length ? filterParts.join(", ") : "none"
            }`
          );
          ctx.textContent = lines.join("\n");
        };

        watch(
          tasks,
          () => {
            persistState();
            updateTasksContext();
            updateAssignmentsContext();
            updateProfileContext();
            updateColumnsContext();
          },
          { deep: true, immediate: true }
        );

        watch(
          () => [
            hoveredTaskId.value,
            selectedTaskIds.value.join("|"),
            textSelectionActive.value,
            activeModalTaskId.value,
            selectedTextContent.value,
          ],
          updateInteractionContext,
          { immediate: true }
        );

        watch(
          columns,
          () => {
            ensureNewTaskColumn();
            persistState();
            updateTasksContext();
            updateAssignmentsContext();
            updateProfileContext();
            updateColumnsContext();
          },
          { deep: true, immediate: true }
        );

        watch(
          () => [
            searchQuery.value,
            assigneeFilter.value,
            showOnlyMine.value,
          ],
          () => {
            updateTasksContext();
            updateAssignmentsContext();
            updateProfileContext();
            updateColumnsContext();
          }
        );

        watch(
          () => [
            currentUser.name,
            currentUser.role,
            currentUser.email,
            currentUser.status,
          ],
          () => {
            updateProfileContext();
          },
          { immediate: true }
        );

        watch(activeModalTaskId, (taskId) => {
          document.body.classList.toggle("modal-open", Boolean(taskId));
        });

        const getTaskById = (id) => tasks.value.find((t) => t.id === id) || null;

        const setTaskAssignee = ({ id, assigneeId }) => {
          console.log("[assign] incoming", { id, assigneeId });
          const task = getTaskById(id);
          if (!task) {
            console.warn("[assign] task not found", id);
            return false;
          }
          const normalized = normalizeAssigneeInput(assigneeId);
          console.log("[assign] normalized value", normalized);
          if (normalized) {
            if (!teammateLookup[normalized]) return false;
            if (task.assigneeId === normalized) return false;
            task.assigneeId = normalized;
            notifyTasksChanged();
            return true;
          }
          if (assigneeId === null || assigneeId === "" || assigneeId === "__unassigned__") {
            if (task.assigneeId == null) return false;
            task.assigneeId = null;
            notifyTasksChanged();
            return true;
          }
          console.warn("[assign] unable to interpret assignee", assigneeId);
          return false;
        };

        const createTask = ({
          title,
          description = "",
          columnId = "todo",
          assigneeId = null,
        }) => {
          const trimmedTitle = (title || "").trim();
          if (!trimmedTitle) return;
          const normalizedColumn = columns.value.some((col) => col.id === columnId)
            ? columnId
            : "todo";
          const normalizedAssignee =
            assigneeId && teammateLookup[assigneeId] ? assigneeId : null;
          const task = {
            id: makeId("task"),
            title: trimmedTitle,
            description: (description || "").trim(),
            columnId: normalizedColumn,
            totalMinutes: 0,
            timeEntries: [],
            comments: [],
            assigneeId: normalizedAssignee,
          };
          tasks.value.unshift(task);
          setSelection([task.id]);
        };

        const updateTask = ({ id, title, description, columnId, assigneeId }) => {
          const task = getTaskById(id);
          if (!task) return;
          let changed = false;
          if (typeof title === "string") {
            task.title = title;
            changed = true;
          }
          if (typeof description === "string") {
            task.description = description;
            changed = true;
          }
          if (typeof columnId === "string" && columns.value.some((col) => col.id === columnId)) {
            task.columnId = columnId;
            changed = true;
          }
          if (changed) notifyTasksChanged();
          if (typeof assigneeId !== "undefined") {
            setTaskAssignee({ id, assigneeId });
          }
        };

        const moveTask = ({ id, toColumnId, position }) => {
          const idx = tasks.value.findIndex((t) => t.id === id);
          if (idx === -1) return;
          const [task] = tasks.value.splice(idx, 1);
          if (typeof toColumnId === "string" && columns.value.some((col) => col.id === toColumnId)) {
            task.columnId = toColumnId;
          }
          let insertIndex = tasks.value.length;
          if (typeof position === "number" && position >= 0) {
            let countInCol = 0;
            for (let i = 0; i < tasks.value.length; i++) {
              if (tasks.value[i].columnId === task.columnId) {
                if (countInCol === position) {
                  insertIndex = i;
                  break;
                }
                countInCol++;
              }
            }
          }
          tasks.value.splice(insertIndex, 0, task);
        };

        const deleteTask = ({ id }) => {
          const idx = tasks.value.findIndex((t) => t.id === id);
          if (idx === -1) return;
          tasks.value.splice(idx, 1);
          if (hoveredTaskId.value === id) hoveredTaskId.value = null;
          if (activeModalTaskId.value === id) activeModalTaskId.value = null;
          if (selectedTaskIds.value.includes(id)) {
            setSelection(selectedTaskIds.value.filter((taskId) => taskId !== id));
          }
        };

        const addTimeEntryForTask = (taskId, minutes, note = "") => {
          const task = getTaskById(taskId);
          if (!task) return;
          const value = Number(minutes) || 0;
          if (value <= 0) return;
          if (!Array.isArray(task.timeEntries)) task.timeEntries = [];
          const entry = {
            id: makeId("time"),
            minutes: value,
            note: note || "",
            createdAt: new Date().toISOString(),
          };
          task.timeEntries.push(entry);
          task.totalMinutes = (task.totalMinutes || 0) + value;
        };

        const addCommentForTask = (taskId, text) => {
          const task = getTaskById(taskId);
          if (!task) return;
          const trimmed = (text || "").trim();
          if (!trimmed) return;
          if (!Array.isArray(task.comments)) task.comments = [];
          const comment = {
            id: makeId("comment"),
            text: trimmed,
            createdAt: new Date().toISOString(),
          };
          task.comments.push(comment);
        };

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
          if (!contextMenu.value.open) return;
          closeSubmenu();
          contextMenu.value = {
            open: false,
            x: 0,
            y: 0,
            targetIds: [],
            submenu: null,
          };
        };

        const handleGlobalClick = (event) => {
          if (!contextMenu.value.open) return;
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
          contextMenu.value = {
            open: true,
            x,
            y,
            targetIds,
            submenu: null,
          };
        };

        const openSubmenu = (event, type) => {
          const submenuWidth = 220;
          const submenuHeight = 260;
          const gutter = 0;
          const rect = event.currentTarget.getBoundingClientRect();
          const baseX = rect.right + window.scrollX + gutter;
          const baseY = rect.top + window.scrollY;
          const maxX = window.scrollX + window.innerWidth - submenuWidth - gutter;
          const maxY = window.scrollY + window.innerHeight - submenuHeight - gutter;
          const x = Math.min(baseX, maxX);
          const y = Math.min(Math.max(baseY, window.scrollY + gutter), maxY);
          contextMenu.value = {
            ...contextMenu.value,
            submenu: type,
          };
        };

        const closeSubmenu = () => {
          contextMenu.value = {
            ...contextMenu.value,
            submenu: null,
          };
        };

        const openSelectedInModal = () => {
          const id = contextMenu.value.targetIds[0];
          if (id) {
            openTaskModal(id);
          }
          closeContextMenu();
        };

        const moveSelectedToColumn = (columnId) => {
          contextMenu.value.targetIds.forEach((taskId) => {
            moveTask({ id: taskId, toColumnId: columnId });
          });
          closeContextMenu();
        };

        const assignSelectedTo = (assigneeId) => {
          contextMenu.value.targetIds.forEach((taskId) => {
            setTaskAssignee({ id: taskId, assigneeId });
          });
          closeContextMenu();
        };

        const duplicateSelectedTasks = () => {
          const clones = contextMenu.value.targetIds
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
          closeContextMenu();
        };

        const deleteSelectedTasks = () => {
          contextMenu.value.targetIds.forEach((taskId) =>
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
          setTaskAssignee({ id: targetId, assigneeId });
        };

        const assignTaskToMember = ({ id, assigneeId }) => {
          if (!id) return;
          setTaskAssignee({ id, assigneeId });
        };

        const clearTaskAssignee = ({ id }) => {
          if (!id) return;
          setTaskAssignee({ id, assigneeId: null });
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
          teammates: teammates.map((member) => ({ ...member })),
          currentUser: { ...currentUser },
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
            if (contextMenu.value.open) {
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
          updateTasksContext();
          updateAssignmentsContext();
          updateInteractionContext();
          updateProfileContext();
          updateColumnsContext();
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
          openSubmenu,
          closeSubmenu,
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
    }).mount("#app");
