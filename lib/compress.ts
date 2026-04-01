import imageCompression from 'browser-image-compression'

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxWidthOrHeight: 800,
    initialQuality: 0.8,
    useWebWorker: true,
    fileType: 'image/webp' as const,
  }
  return imageCompression(file, options)
}
