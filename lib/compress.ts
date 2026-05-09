import imageCompression from 'browser-image-compression'

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxWidthOrHeight: 1600, // Increased for recipe photos
    initialQuality: 0.85,
    useWebWorker: true,
    fileType: 'image/webp' as const,
  }
  return imageCompression(file, options)
}
