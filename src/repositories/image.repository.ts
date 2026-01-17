import { uploadImage, deleteImage } from '../utils/storage.util';

/**
 * Image Repository
 * Python의 meeting/repository.py의 ImageRepository와 동일한 역할
 */
export class ImageRepository {
  /**
   * Python: async def upload_image(self, image: UploadFile)
   */
  async uploadImage(filename: string, buffer: Buffer): Promise<void> {
    await uploadImage(filename, buffer);
  }

  /**
   * Python: def delete_image(self, image_key)
   */
  async deleteImage(imageKey: string): Promise<void> {
    await deleteImage(imageKey);
  }
}

