export type StoredCustomerTask = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  state: "Опубликована" | "Черновик";
  applications: number;
  people: string[];
  deadline: string;
  result: string;
  problem: string;
  expected: string;
  criteria: string[];
};

const storageKey = "impulse-customer-created-tasks-v1";

export function loadCustomerTasks(): StoredCustomerTask[] {
  try {
    const value = localStorage.getItem(storageKey);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as StoredCustomerTask[] : [];
  } catch {
    return [];
  }
}

export function storeCustomerTask(task: StoredCustomerTask) {
  const tasks = loadCustomerTasks().filter((item) => item.id !== task.id);
  localStorage.setItem(storageKey, JSON.stringify([task, ...tasks]));
}
