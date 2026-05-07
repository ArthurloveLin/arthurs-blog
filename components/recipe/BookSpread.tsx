interface BookSpreadProps {
  left: React.ReactNode
  right: React.ReactNode
}

export default function BookSpread({ left, right }: BookSpreadProps) {
  return (
    <div className="bs-carousel-item">
      <div className="bs-page-container">
        <div className="bs-left-page">{left}</div>
        <div className="bs-right-page">{right}</div>
      </div>
    </div>
  )
}
