export default function OfflinePage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-2xl">📡</p>
        <h1 className="text-xl font-semibold">当前离线</h1>
        <p className="text-sm text-muted-foreground">请检查网络连接后刷新页面</p>
      </div>
    </main>
  )
}
