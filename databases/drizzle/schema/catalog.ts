import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const productStatus = pgEnum("product_status", [
  "active",
  "draft",
  "archived",
]);

export const category = pgTable(
  "category",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    parentId: text("parent_id").references((): any => category.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("category_parentId_idx").on(table.parentId)],
);

export const product = pgTable(
  "product",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    categoryId: text("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    status: productStatus("status").default("draft").notNull(),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("product_categoryId_idx").on(table.categoryId)],
);

export const productVariant = pgTable(
  "product_variant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    barcode: text("barcode").unique(),
    // e.g. { "color": "red", "size": "M" }
    attributes: jsonb("attributes").notNull().default({}),
    // overrides product.basePrice when set
    price: numeric("price", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("productVariant_productId_idx").on(table.productId),
    uniqueIndex("productVariant_sku_idx").on(table.sku),
  ],
);

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "categoryParent",
  }),
  children: many(category, { relationName: "categoryParent" }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, {
    fields: [product.categoryId],
    references: [category.id],
  }),
  variants: many(productVariant),
}));

export const productVariantRelations = relations(productVariant, ({ one }) => ({
  product: one(product, {
    fields: [productVariant.productId],
    references: [product.id],
  }),
}));
