import {
  ref,
  watch,
  computed,
  toRefs,
  nextTick,
  onBeforeUnmount,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const TaskModal = {
  name: "TaskModal",
  props: {
    task: { type: Object, default: null },
    visible: { type: Boolean, default: false },
    formatMinutes: { type: Function, required: true },
    teammates: { type: Array, default: () => [] },
  },
  emits: [
    "close",
    "update-task",
    "add-time",
    "add-comment",
    "delete-task",
    "set-assignee",
  ],
  setup(props, { emit }) {
    const { task, visible } = toRefs(props);
    const timeMinutes = ref("");
    const timeNote = ref("");
    const commentText = ref("");
    const selectedAssigneeId = ref("");
    const closeToolRef = ref(null);
    let removeCloseToolListener = null;

    const resetForms = () => {
      timeMinutes.value = "";
      timeNote.value = "";
      commentText.value = "";
    };

    watch(
      () => (task.value ? task.value.id : null),
      () => resetForms()
    );

    watch(
      () => (task.value ? task.value.assigneeId : null),
      (assigneeId) => {
        selectedAssigneeId.value = assigneeId || "";
      },
      { immediate: true }
    );

    const handleClose = () => emit("close");

    const handleTitleInput = (event) => {
      if (!task.value) return;
      emit("update-task", { id: task.value.id, title: event.target.value });
    };

    const handleDescriptionInput = (event) => {
      if (!task.value) return;
      emit("update-task", {
        id: task.value.id,
        description: event.target.value,
      });
    };

    const handleAddTime = () => {
      if (!task.value) return;
      const minutes = parseInt(timeMinutes.value, 10);
      if (!minutes || minutes <= 0) return;
      emit("add-time", { minutes, note: timeNote.value });
      timeMinutes.value = "";
      timeNote.value = "";
    };

    const handleAddComment = () => {
      if (!task.value) return;
      const text = commentText.value.trim();
      if (!text) return;
      emit("add-comment", { text });
      commentText.value = "";
    };

    const handleAssigneeSelect = () => {
      if (!task.value) return;
      const nextValue = selectedAssigneeId.value || null;
      emit("set-assignee", { id: task.value.id, assigneeId: nextValue });
    };

    const handleDelete = () => {
      if (!task.value) return;
      const shouldDelete = window.confirm(
        "Delete this task? This action cannot be undone."
      );
      if (!shouldDelete) return;
      emit("delete-task", { id: task.value.id });
    };

    const assigneeName = computed(() => {
      if (!task.value) return "Unassigned";
      if (!task.value.assigneeId) return "Unassigned";
      const member = props.teammates.find(
        (person) => person.id === task.value.assigneeId
      );
      return member ? member.name : `Unmapped member (${task.value.assigneeId})`;
    });

    const registerCloseTool = () => {
      if (removeCloseToolListener) return;
      const el = closeToolRef.value;
      if (!el) return;
      const handler = () => emit("close");
      el.addEventListener("call", handler);
      removeCloseToolListener = () => el.removeEventListener("call", handler);
    };

    const unregisterCloseTool = () => {
      if (removeCloseToolListener) {
        removeCloseToolListener();
        removeCloseToolListener = null;
      }
    };

    watch(
      visible,
      (isVisible) => {
        if (isVisible) {
          nextTick(() => {
            registerCloseTool();
            resetForms();
          });
        } else {
          unregisterCloseTool();
        }
      },
      { immediate: true }
    );

    onBeforeUnmount(unregisterCloseTool);

    return {
      task,
      visible,
      timeMinutes,
      timeNote,
      commentText,
      selectedAssigneeId,
      assigneeName,
      closeToolRef,
      handleClose,
      handleTitleInput,
      handleDescriptionInput,
      handleAddTime,
      handleAddComment,
      handleAssigneeSelect,
      handleDelete,
    };
  },
  template: `
    <div
      v-if="visible && task"
      class="modal-backdrop"
      role="presentation"
      @click.self="handleClose"
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-task-title">
        <div class="modal-header">
          <input
            id="modal-task-title"
            class="modal-title-input"
            :value="task.title"
            placeholder="Task title"
            @input="handleTitleInput"
          />
          <div class="modal-header-actions">
            <button
              type="button"
              class="modal-danger-btn"
              aria-label="Delete task"
              @click="handleDelete"
            >
              Delete
            </button>
            <button
              type="button"
              class="modal-close-btn"
              aria-label="Close task details"
              @click="handleClose"
            >
              &times;
            </button>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">
            <span>Description</span>
          </div>
          <textarea
            class="modal-textarea"
            placeholder="Add details, acceptance criteria, links&hellip;"
            :value="task.description || ''"
            @input="handleDescriptionInput"
          ></textarea>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">
            <span>Assignee</span>
            <span class="modal-pill">
              {{ assigneeName }}
            </span>
          </div>
          <div class="modal-assign-row">
            <select
              class="modal-select"
              v-model="selectedAssigneeId"
              @change="handleAssigneeSelect"
            >
              <option value="">Unassigned</option>
              <option
                v-for="person in teammates"
                :key="person.id"
                :value="person.id"
              >
                {{ person.role ? person.name + ' · ' + person.role : person.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">
            <span>Time tracking</span>
            <span class="modal-pill">
              {{ task.totalMinutes ? formatMinutes(task.totalMinutes) : 'No time logged yet' }}
            </span>
          </div>
          <form class="modal-inline-form" @submit.prevent="handleAddTime">
            <input
              type="number"
              class="modal-number-input"
              min="1"
              step="1"
              placeholder="min"
              v-model="timeMinutes"
            />
            <input
              type="text"
              class="modal-text-input"
              placeholder="What did you work on? (optional)"
              v-model="timeNote"
            />
            <button type="submit">Log</button>
          </form>
          <ul
            class="modal-list"
            :class="{ empty: !(task.timeEntries && task.timeEntries.length) }"
          >
            <li v-if="!(task.timeEntries && task.timeEntries.length)">
              Time entries will appear here.
            </li>
            <li
              v-for="entry in task.timeEntries || []"
              :key="entry.id"
              class="modal-list-item"
            >
              <div>
                <strong>{{ formatMinutes(entry.minutes) }}</strong>
                <span> &mdash; {{ entry.note || 'No note' }}</span>
              </div>
              <small class="modal-list-item-meta">
                {{ new Date(entry.createdAt).toLocaleString() }}
              </small>
            </li>
          </ul>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">
            <span>Comments</span>
          </div>
          <ul
            class="modal-list"
            :class="{ empty: !(task.comments && task.comments.length) }"
          >
            <li v-if="!(task.comments && task.comments.length)">No comments yet.</li>
            <li
              v-for="comment in task.comments || []"
              :key="comment.id"
              class="modal-list-item"
            >
              <p>{{ comment.text }}</p>
              <small class="modal-list-item-meta">
                {{ new Date(comment.createdAt).toLocaleString() }}
              </small>
            </li>
          </ul>
          <form class="modal-inline-form" @submit.prevent="handleAddComment">
            <input
              type="text"
              class="modal-text-input"
              placeholder="Add a comment&hellip;"
              v-model="commentText"
            />
            <button type="submit">Comment</button>
          </form>
        </div>
        <tool
          ref="closeToolRef"
          name="close_task_modal"
          description="Close the currently open task modal"
        ></tool>
      </div>
    </div>
  `,
};
