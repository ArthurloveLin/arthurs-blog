interface BookSpreadProps {
  left: React.ReactNode
  right: React.ReactNode
  rightOverlay?: React.ReactNode
}

export default function BookSpread({ left, right, rightOverlay }: BookSpreadProps) {
  return (
    <div className="bs-carousel-item">
      <div className="bs-page-container">
        <div className="bs-left-page">{left}</div>
        <div className="bs-right-page">
          <div className="bs-right-page-scroll">{right}</div>
          {rightOverlay}
        </div>
      </div>
    </div>
  )
}
