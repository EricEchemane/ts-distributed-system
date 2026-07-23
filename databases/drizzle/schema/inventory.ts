import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { productVariant } from "./catalog";

export const storeLocation = pgTable("store_location", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const inventory = pgTable(
  "inventory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => storeLocation.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(0).notNull(),
    // stock allocated to unfulfilled orders; available = quantity - reservedQuantity
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_variantId_locationId_idx").on(
      table.variantId,
      table.locationId,
    ),
  ],
);

export const storeLocationRelations = relations(storeLocation, ({ many }) => ({
  inventory: many(inventory),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(productVariant, {
    fields: [inventory.variantId],
    references: [productVariant.id],
  }),
  location: one(storeLocation, {
    fields: [inventory.locationId],
    references: [storeLocation.id],
  }),
}));
