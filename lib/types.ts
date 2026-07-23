export const EventCatalog = {
  OrderCreated: "order.created",
  UserCreated: "user.created",
  OrderUpdated: "order.updated",
} as const;

export const EventGroup = {
  Inventory: "inventory",
} as const;

export const EventConsumer = {
  InventoryWorker: "inventory-worker",
} as const;

export interface AppEvent {
  id: string;
  type: (typeof EventCatalog)[keyof typeof EventCatalog];
  payload: string;
  createdAt: string;
}
