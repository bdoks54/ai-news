import "server-only";
import Parser from "rss-parser";

export type Source = "techcrunch" | "theverge";

export const FEEDS: { source: Source; label: string; url: string }[] = [
  {
    source: "techcrunch",
    label: "TechCrunch",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    source: "theverge",
    label: "The Verge",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
];

export const SOURCE_LABEL: Record<Source, string> = {
  techcrunch: "TechCrunch",
  theverge: "The Verge",
};

export type FeedItem = {
  source: Source;
  url: string;
  title: string;
  author: string | null;
  snippet: string;
  publishedAt: Date | null;
};

const parser = new Parser({ timeout: 15000 });

function clean(text: string | undefined, max = 1500): string {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** 모든 피드를 병렬로 가져온다. 실패한 피드는 failed에 담고 나머지 결과는 돌려준다. */
export async function fetchAllFeeds(): Promise<{ items: FeedItem[]; failed: string[] }> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items
        .filter((it) => it.link && it.title)
        .map<FeedItem>((it) => ({
          source: feed.source,
          url: it.link!.trim(),
          title: clean(it.title, 300),
          // RSS는 dc:creator(creator), Atom은 author.name(author)에 작성자가 들어 있다.
          author: clean(it.creator ?? (it as { author?: string }).author, 200) || null,
          snippet: clean(it.contentSnippet ?? it.content ?? it.summary),
          publishedAt: it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null,
        }));
    }),
  );

  const items: FeedItem[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else {
      console.error(`[rss] ${FEEDS[i].label} 실패:`, r.reason);
      failed.push(FEEDS[i].label);
    }
  });

  // 같은 URL 중복 제거
  const seen = new Set<string>();
  return {
    items: items.filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true))),
    failed,
  };
}
