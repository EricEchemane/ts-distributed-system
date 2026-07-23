import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { address } from "./address";
import { productVariant } from "./catalog";

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
]);

export const order = pgTable(
  "order",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    status: orderStatus("status").default("pending").notNull(),
    shippingAddressId: text("shipping_address_id").references(
      () => address.id,
    ),
    billingAddressId: text("billing_address_id").references(() => address.id),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingFee: numeric("shipping_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("order_userId_idx").on(table.userId)],
);

export const orderItem = pgTable(
  "order_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    // nullable + snapshot fields below so deleting a variant never corrupts order history
    variantId: text("variant_id").references(() => productVariant.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("orderItem_orderId_idx").on(table.orderId)],
);

export const payment = pgTable(
  "payment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: paymentStatus("status").default("pending").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    externalReference: text("external_reference"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("payment_orderId_idx").on(table.orderId)],
);

export const orderRelations = relations(order, ({ one, many }) => ({
  user: one(user, {
    fields: [order.userId],
    references: [user.id],
  }),
  shippingAddress: one(address, {
    fields: [order.shippingAddressId],
    references: [address.id],
    relationName: "shippingAddress",
  }),
  billingAddress: one(address, {
    fields: [order.billingAddressId],
    references: [address.id],
    relationName: "billingAddress",
  }),
  items: many(orderItem),
  payments: many(payment),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, {
    fields: [orderItem.orderId],
    references: [order.id],
  }),
  variant: one(productVariant, {
    fields: [orderItem.variantId],
    references: [productVariant.id],
  }),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
  order: one(order, {
    fields: [payment.orderId],
    references: [order.id],
  }),
}));
