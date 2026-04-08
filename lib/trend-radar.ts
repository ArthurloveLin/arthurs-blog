import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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

export async function getLatestTrendRadarData(): Promise<TrendRadarData | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_WARDROBE_BUCKET,
      Key: "reports/latest.json",
    });

    const response = await r2Client.send(command);
    const bodyContents = await response.Body?.transformToString();

    if (!bodyContents) {
      return null;
    }

    return JSON.parse(bodyContents);
  } catch (error) {
    console.error("Error fetching TrendRadar data from R2:", error);
    return null;
  }
}
