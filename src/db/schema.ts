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
    author: text("author"), // 원문 작성자. 피드에 없으면 null
    snippet: text("snippet").notNull().default(""), // RSS 본문 요약(태그 제거). 나중에 Claude 요약의 입력으로 쓴다.
    // 한국어 제목·요약. Claude 처리 전에는 null이며, 화면에서는 원문 제목·snippet으로 대체 표시한다.
    titleKo: text("title_ko"),
    summaryKo: text("summary_ko"),
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
