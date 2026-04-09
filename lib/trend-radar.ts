import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { listR2ObjectsWithMeta } from "./r2";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export interface TrendTitle {
  title: string;
  source_name?: string;
  url?: string;
  mobile_url?: string;
  is_new?: boolean;
  ranks?: number[];
  count?: number;
  time_display?: string;
}

export interface HotKeyword {
  word: string;
  count?: number;
  percentage?: number;
  titles?: TrendTitle[];
}

export interface NewSource {
  source_id: string;
  source_name: string;
  titles?: TrendTitle[];
}

/** rss_items 与 stats 结构相同：按关键词分组，每组含 titles 数组 */
export interface RssGroup {
  word: string;
  count: number;
  titles?: TrendTitle[];
}

export interface StandalonePlatform {
  id: string;
  name: string;
  items: Array<{
    title: string;
    url?: string;
    rank?: number;
    time_display?: string;
    published_at?: string;
    author?: string;
  }>;
}

export interface StandaloneData {
  platforms?: StandalonePlatform[];
  rss_feeds?: StandalonePlatform[];
}

// 保留旧别名，避免其他文件报错
export type RssItem = RssGroup;

export interface TrendRadarData {
  stats: HotKeyword[];
  new_titles: NewSource[];
  rss_items: RssGroup[];
  standalone_data?: StandaloneData | null;
  total_new_count: number;
  failed_ids: string[];
  generated_at?: string;
}

export async function getTrendRadarData(key: string = "reports/latest.json"): Promise<TrendRadarData | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_WARDROBE_BUCKET,
      Key: key,
    });

    const response = await r2Client.send(command);
    const bodyContents = await response.Body?.transformToString();

    if (!bodyContents) {
      return null;
    }

    return JSON.parse(bodyContents);
  } catch (error) {
    console.error(`Error fetching TrendRadar data from R2 (Key: ${key}):`, error);
    return null;
  }
}

// Keep the old name for convenience if needed, but point to the new one
export const getLatestTrendRadarData = () => getTrendRadarData("reports/latest.json");

export async function listTrendRadarReports() {
  try {
    const bucket = process.env.R2_WARDROBE_BUCKET || "";
    const prefix = "reports/";
    const allItems = await listR2ObjectsWithMeta(bucket, prefix);
    
    // Filter for YYYY-MM-DD/HH-mm.json pattern
    const reports = allItems
      .filter(item => /reports\/\d{4}-\d{2}-\d{2}\/\d{2}-\d{2}\.json/.test(item.key))
      .sort((a, b) => b.key.localeCompare(a.key)); // Sort descending (newest first)
    
    // Get unique dates and limit to last 3 days
    const dates = Array.from(new Set(reports.map(r => r.key.split('/')[1])))
      .sort()
      .reverse()
      .slice(0, 3);
      
    // For each date, pick the latest report (first one in our sorted list)
    const latestEachDay = dates.map(date => reports.find(r => r.key.split('/')[1] === date)!).filter(Boolean);
    
    return latestEachDay.map(r => ({
      key: r.key,
      date: r.key.split('/')[1],
      time: r.key.split('/')[2].replace('.json', '').replace('-', ':'),
      rawTime: r.key.split('/')[2].replace('.json', '')
    }));
  } catch (error) {
    console.error("Error listing TrendRadar reports:", error);
    return [];
  }
}
