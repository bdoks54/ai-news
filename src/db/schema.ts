import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#6366f1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("categories_user_name_uq").on(t.userId, t.name)],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    source: text("source", { enum: ["techcrunch", "theverge"] }).notNull(),
    originalUrl: text("original_url").notNull(),
    originalTitle: text("original_title").notNull(),
    titleKo: text("title_ko").notNull(),
    summaryKo: text("summary_ko").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // null = 미분류. 카테고리가 삭제되면 자동으로 미분류가 된다.
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    notionPageUrl: text("notion_page_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("articles_user_url_uq").on(t.userId, t.originalUrl),
    index("articles_user_published_idx").on(t.userId, t.publishedAt),
  ],
);

export const notionConnections = pgTable("notion_connections", {
  userId: text("user_id").primaryKey(),
  clientId: text("client_id").notNull(),
  accessToken: text("access_token").notNull(), // 암호화된 값
  refreshToken: text("refresh_token"), // 암호화된 값
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  parentPageUrl: text("parent_page_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type Article = typeof articles.$inferSelect;
