import {
  ref,
  watch,
  computed,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";

export const ProfilePanel = {
  name: "ProfilePanel",
  props: {
    visible: { type: Boolean, default: false },
    currentUser: { type: Object, required: true },
    stats: { type: Object, required: true },
    myTasks: { type: Array, default: () => [] },
    teammates: { type: Array, default: () => [] },
    filterSummary: { type: Array, default: () => [] },
  },
  emits: ["close", "save-profile"],
  setup(props, { emit }) {
    const formName = ref("");
    const formRole = ref("");
    const formEmail = ref("");
    const formStatus = ref("");

    const syncForm = () => {
      formName.value = props.currentUser.name || "";
      formRole.value = props.currentUser.role || "";
      formEmail.value = props.currentUser.email || "";
      formStatus.value = props.currentUser.status || "";
    };

    watch(
      () => props.visible,
      (visible) => {
        if (visible) {
          syncForm();
        }
      },
      { immediate: true }
    );

    watch(
      () => [
        props.currentUser.name,
        props.currentUser.role,
        props.currentUser.email,
        props.currentUser.status,
      ],
      () => {
        if (!props.visible) {
          syncForm();
        }
      }
    );

    const handleClose = () => emit("close");

    const handleSave = () => {
      emit("save-profile", {
        name: formName.value,
        role: formRole.value,
        email: formEmail.value,
        status: formStatus.value,
      });
    };

    const handleReset = () => {
      syncForm();
    };

    const humanFilters = computed(() =>
      props.filterSummary.length ? props.filterSummary : ["none"]
    );

    watch(
      () => props.visible,
      (visible) => {
        if (visible) {
          syncForm();
        }
      },
      { immediate: true }
    );

    return {
      handleClose,
      handleSave,
      handleReset,
      formName,
      formRole,
      formEmail,
      formStatus,
      humanFilters,
    };
  },
  template: `
    <div
      v-if="visible"
      class="profile-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Profile details"
      @click.self="handleClose"
    >
      <div class="profile-panel">
        <div class="profile-panel__header">
          <div>
            <h2 style="margin:0">{{ currentUser.name }}</h2>
            <small>{{ currentUser.role }} · {{ currentUser.email }}</small>
          </div>
          <button
            type="button"
            class="profile-panel__close"
            aria-label="Close profile"
            @click="handleClose"
          >
            &times;
          </button>
        </div>
        <div class="profile-panel__body">
          <section class="profile-panel__section">
            <h3>Quick stats</h3>
            <div class="profile-panel__grid">
              <div class="profile-panel__card">
                <strong>{{ stats.open }}</strong>
                <div>Open tasks</div>
              </div>
              <div class="profile-panel__card">
                <strong>{{ stats.closed }}</strong>
                <div>Completed</div>
              </div>
              <div class="profile-panel__card">
                <strong>{{ stats.totalTime }}</strong>
                <div>Total time logged</div>
              </div>
              <div class="profile-panel__card">
                <strong>{{ stats.doneColumn }}</strong>
                <div>Board done items</div>
              </div>
            </div>
          </section>

          <section class="profile-panel__section">
            <h3>Edit profile</h3>
            <form class="profile-panel__form" @submit.prevent="handleSave">
              <label class="profile-panel__card">
                <span>Name</span>
                <input type="text" v-model="formName" required />
              </label>
              <label class="profile-panel__card">
                <span>Role</span>
                <input type="text" v-model="formRole" required />
              </label>
              <label class="profile-panel__card">
                <span>Email</span>
                <input type="email" v-model="formEmail" required />
              </label>
              <label class="profile-panel__card" style="grid-column: span 2;">
                <span>Status</span>
                <textarea v-model="formStatus" rows="2" required></textarea>
              </label>
              <div class="profile-panel__actions" style="grid-column: span 2;">
                <button type="submit" class="profile-panel__save">
                  Save changes
                </button>
                <button type="button" class="profile-panel__reset" @click="handleReset">
                  Reset
                </button>
              </div>
            </form>
          </section>

          <section class="profile-panel__section">
            <h3>Filters</h3>
            <ul class="profile-panel__list">
              <li v-for="item in humanFilters" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="profile-panel__section">
            <h3>My assigned tasks</h3>
            <ul class="profile-panel__list">
              <li v-if="!myTasks.length">No tasks assigned right now.</li>
              <li v-for="task in myTasks" :key="task.id">
                {{ task.title }} <small>({{ task.columnId }})</small>
              </li>
            </ul>
          </section>

          <section class="profile-panel__section">
            <h3>Team roster</h3>
            <ul class="profile-panel__list">
              <li v-for="member in teammates" :key="member.id">
                {{ member.name }} - {{ member.role }}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  `,
};
