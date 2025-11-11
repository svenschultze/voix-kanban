export const STORAGE_KEY = "voix-kanban-state";

export const defaultColumns = [
  { id: "todo", title: "To Do", color: "#f97316" },
  { id: "in-progress", title: "In Progress", color: "#0ea5e9" },
  { id: "done", title: "Done", color: "#10b981" },
];

export const teammates = Object.freeze([
  { id: "ava", name: "Ava Patel", role: "Design" },
  { id: "leo", name: "Leo Garcia", role: "Frontend" },
  { id: "mia", name: "Mia Chen", role: "Product" },
  { id: "noor", name: "Noor Ibrahim", role: "QA" },
  { id: "kai", name: "Kai Müller", role: "Backend" },
  { id: "sara", name: "Sara Novak", role: "Project Mgmt" },
  { id: "emiko", name: "Emiko Tanaka", role: "UX Research" },
  { id: "diego", name: "Diego Santos", role: "DevOps" },
  { id: "bella", name: "Bella Rossi", role: "Content" },
  { id: "amir", name: "Amir Jalali", role: "Security" },
  { id: "lena", name: "Lena Vogt", role: "Data Science" },
  { id: "haru", name: "Haru Watanabe", role: "Support" },
  { id: "quinn", name: "Quinn Ellis", role: "Marketing" },
  { id: "zoe", name: "Zoe Laurent", role: "Customer Success" },
]);

export const createDefaultTasks = () => [
  {
    id: "task-1",
    title: "Design landing page",
    description: "Create hero section and above-the-fold layout",
    columnId: "todo",
    assigneeId: "ava",
    totalMinutes: 45,
    timeEntries: [
      {
        id: "time-1",
        minutes: 45,
        note: "Initial wireframes",
        createdAt: new Date().toISOString(),
      },
    ],
    comments: [
      {
        id: "comment-1",
        text: "Remember to include dark mode toggle.",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "task-2",
    title: "Connect VOIX tools",
    description: "Wire up create/move/delete tools in JS",
    columnId: "in-progress",
    assigneeId: "leo",
  },
  {
    id: "task-3",
    title: "Write interaction context",
    description: "Hover, selection, modal and active task state",
    columnId: "in-progress",
    assigneeId: "mia",
  },
  {
    id: "task-4",
    title: "Polish visual design",
    description: "Spacing, shadows, responsiveness",
    columnId: "done",
    assigneeId: "noor",
    totalMinutes: 30,
    timeEntries: [
      {
        id: "time-2",
        minutes: 30,
        note: "Tweaked spacing & shadows",
        createdAt: new Date().toISOString(),
      },
    ],
  },
];
