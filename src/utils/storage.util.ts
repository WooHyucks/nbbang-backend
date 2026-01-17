import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Storage Utility (S3)
 * Python의 base/storage_connector.py와 동일한 역할
 */

const AWS_S3_ACCESS_KEY = process.env.AWS_S3_ACCESS_KEY;
const AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY;
const AWS_REGION = 'ap-northeast-2';
const BUCKET_NAME = 'nbbang-receipt-images';

// S3는 영수증 이미지 업로드 기능을 사용할 때만 필요합니다
// 이미지 업로드 기능을 사용하지 않는다면 선택 사항입니다
const isS3Enabled = AWS_S3_ACCESS_KEY && AWS_S3_SECRET_ACCESS_KEY;

const s3Client = isS3Enabled
  ? new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_S3_ACCESS_KEY,
        secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

/**
 * Python: async def create_image(self, image: UploadFile)
 */
export async function uploadImage(filename: string, buffer: Buffer): Promise<void> {
  if (!s3Client) {
    throw new Error('S3 is not configured. Please set AWS_S3_ACCESS_KEY and AWS_S3_SECRET_ACCESS_KEY in your .env file');
  }
  // Python: self.storage_client.upload_fileobj(file_like_object, "nbbang-receipt-images", image.filename, ExtraArgs={"ContentType": "image/webp"})
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: 'image/webp',
  });
  
  await s3Client.send(command);
}

/**
 * Python: def delete_image(self, filename)
 */
export async function deleteImage(filename: string): Promise<void> {
  if (!s3Client) {
    throw new Error('S3 is not configured. Please set AWS_S3_ACCESS_KEY and AWS_S3_SECRET_ACCESS_KEY in your .env file');
  }
  // Python: self.storage_client.delete_object(Bucket="nbbang-receipt-images", Key=filename + ".webp")
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `${filename}.webp`,
  });
  
  await s3Client.send(command);
}

