import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

export async function getR2Object(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await r2Client.send(command)
  return response.Body!.transformToString('utf-8')
}

export async function getR2ObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await r2Client.send(command)
  const bytes = await response.Body!.transformToByteArray()
  return Buffer.from(bytes)
}

export async function putR2Object(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  await r2Client.send(command)
}

export async function deleteR2Object(bucket: string, key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key })
  await r2Client.send(command)
}

export async function listR2Objects(bucket: string, prefix?: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })
    const response: ListObjectsV2CommandOutput = await r2Client.send(command)
    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return keys
}
