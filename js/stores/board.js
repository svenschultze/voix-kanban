
import { ref, reactive, computed, watch } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { defineStore } from "https://cdn.jsdelivr.net/npm/pinia@3.0.4/+esm";
import {
  STORAGE_KEY,
  defaultColumns,
  teammates,
  createDefaultTasks,
} from "../data.js";
import { cloneColumns, cloneTasks, makeId, formatMinutes } from "../helpers.js";

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
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : createDefaultTasks(),
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

const accentPalette = [
  "#f97316",
  "#0ea5e9",
  "#10b981",
  "#a855f7",
  "#f43f5e",
  "#14b8a6",
];

export const useBoardStore = defineStore("board", () => {
  const initial = loadInitialState();

  const columns = ref(cloneColumns(initial.columns));
  const tasks = ref(initial.tasks);
  const teammatesList = ref(teammates);
  const currentUser = reactive({
    id: "leo",
    name: "Leo Garcia",
    role: "Frontend Lead",
    email: "leo.garcia@voix.demo",
    status: "Available · Reviewing kanban board",
  });

  const hoveredTaskId = ref(null);
  const selectedTaskIds = ref([]);
  const lastSelectedTaskId = ref(null);
  const textSelectionActive = ref(false);
  const selectedTextContent = ref("");
  const draggedTaskIds = ref([]);
  const dragOverColumnId = ref(null);
  const activeModalTaskId = ref(null);
  const searchQuery = ref("");
  const assigneeFilter = ref("");
  const showOnlyMine = ref(false);
  const profileOpen = ref(false);
  const columnEditorOpen = ref(false);
  const columnDragState = ref({ id: null });

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

  const notifyTasksChanged = () => {
    tasks.value = tasks.value.map((task) => ({ ...task }));
    persistState();
  };

  const notifyColumnsChanged = () => {
    columns.value = cloneColumns(columns.value);
    persistState();
  };

  watch(
    [tasks, columns],
    () => {
      persistState();
    },
    { deep: true }
  );

  const teammateLookup = computed(() =>
    teammatesList.value.reduce((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, Object.create(null))
  );

  const currentUserInitials = computed(() =>
    currentUser.name
      .split(" ")
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase()
  );

  const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

  const hasActiveFilters = computed(() =>
    Boolean(
      normalizedSearch.value ||
        assigneeFilter.value ||
        showOnlyMine.value
    )
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

  const filteredTasks = computed(() => tasks.value.filter((task) => matchesFilters(task)));

  const filteredTasksCount = computed(() => filteredTasks.value.length);

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

  const myTasksPreview = computed(() => myAssignedTasks.value.slice(0, 5));

  const doneTasksCount = computed(
    () => tasks.value.filter((task) => task.columnId === "done").length
  );

  const upcomingTasksCount = computed(() =>
    tasks.value.length - doneTasksCount.value
  );

  const profileStats = computed(() => ({
    open: myOpenTasksCount.value,
    closed: myCompletedTasksCount.value,
    totalTime: formatMinutes(totalTimeLogged.value),
    doneColumn: doneTasksCount.value,
  }));

  const getTaskById = (id) => tasks.value.find((task) => task.id === id) || null;

  const getAssigneeLabel = (assigneeId) => {
    if (!assigneeId) return "Unassigned";
    const member = teammateLookup.value[assigneeId];
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
    const directMatch = teammatesList.value.find(
      (member) =>
        member.id.toLowerCase() === lowered ||
        member.name.toLowerCase() === lowered ||
        (member.email && member.email.toLowerCase() === lowered)
    );
    if (directMatch) return directMatch.id;
    if (teammateLookup.value[text]) return text;
    return null;
  };

  const setTaskAssignee = ({ id, assigneeId }) => {
    const task = getTaskById(id);
    if (!task) {
      console.warn("[assign] task not found", id);
      return false;
    }
    const normalized = normalizeAssigneeInput(assigneeId);
    if (normalized) {
      if (!teammateLookup.value[normalized]) return false;
      if (task.assigneeId === normalized) return false;
      task.assigneeId = normalized;
      notifyTasksChanged();
      return true;
    }
    if (
      assigneeId === null ||
      assigneeId === "" ||
      assigneeId === "__unassigned__"
    ) {
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
      assigneeId && teammateLookup.value[assigneeId] ? assigneeId : null;
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
    selectedTaskIds.value = [task.id];
    notifyTasksChanged();
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
    if (
      typeof columnId === "string" &&
      columns.value.some((col) => col.id === columnId)
    ) {
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
    if (
      typeof toColumnId === "string" &&
      columns.value.some((col) => col.id === toColumnId)
    ) {
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
    persistState();
  };

  const deleteTask = ({ id }) => {
    const idx = tasks.value.findIndex((t) => t.id === id);
    if (idx === -1) return;
    tasks.value.splice(idx, 1);
    if (hoveredTaskId.value === id) hoveredTaskId.value = null;
    if (activeModalTaskId.value === id) activeModalTaskId.value = null;
    if (selectedTaskIds.value.includes(id)) {
      selectedTaskIds.value = selectedTaskIds.value.filter((taskId) => taskId !== id);
    }
    persistState();
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
    notifyTasksChanged();
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
    notifyTasksChanged();
  };

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
      persistState();
    }
  };

  const addColumn = ({ title, color, position } = {}) => {
    const next = cloneColumns(columns.value);
    const newColumn = {
      id: `col-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
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
    persistState();
    return newColumn.id;
  };

  const renameColumn = (id, title) => {
    const next = cloneColumns(columns.value);
    const idx = next.findIndex((col) => col.id === id);
    if (idx === -1) return false;
    next[idx].title = (title || "").trim() || "Untitled column";
    columns.value = next;
    persistState();
    return true;
  };

  const updateColumnColor = (id, color) => {
    const next = cloneColumns(columns.value);
    const idx = next.findIndex((col) => col.id === id);
    if (idx === -1) return false;
    next[idx].color = color || accentPalette[idx % accentPalette.length];
    columns.value = next;
    persistState();
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
    }
    columns.value = next;
    persistState();
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
    persistState();
    return true;
  };

  const setColumnColor = ({ id, color }) => updateColumnColor(id, color);

  const assignTaskToMember = ({ id, assigneeId }) => {
    if (!id) return;
    setTaskAssignee({ id, assigneeId });
  };

  const clearTaskAssignee = ({ id }) => {
    if (!id) return;
    setTaskAssignee({ id, assigneeId: null });
  };

  const openProfilePanel = () => {
    profileOpen.value = true;
  };

  const closeProfilePanel = () => {
    profileOpen.value = false;
  };

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

  return {
    columns,
    tasks,
    teammates: teammatesList,
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
    filteredTasks,
    filteredTasksCount,
    visibleTasksByColumn,
    totalTimeLogged,
    myOpenTasksCount,
    myCompletedTasksCount,
    myTasksPreview,
    doneTasksCount,
    upcomingTasksCount,
    profileStats,
    getAssigneeLabel,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    addTimeEntryForTask,
    addCommentForTask,
    addColumn,
    renameColumn,
    updateColumnColor,
    removeColumn,
    reorderColumn,
    setColumnColor,
    assignTaskToMember,
    clearTaskAssignee,
    openProfilePanel,
    closeProfilePanel,
    updateProfile,
    clearFilters,
    setFiltersFromTool,
    notifyTasksChanged,
    notifyColumnsChanged,
  };
});
