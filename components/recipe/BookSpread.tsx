interface BookSpreadProps {
  left: React.ReactNode
  right: React.ReactNode
  rightOverlay?: React.ReactNode
  motionVariant?: 'page' | 'anchored'
}

export default function BookSpread({ left, right, rightOverlay, motionVariant = 'page' }: BookSpreadProps) {
  return (
    <div className="bs-carousel-item">
      <div className="bs-page-container" data-motion={motionVariant}>
        <div className="bs-left-page">{left}</div>
        <div className="bs-right-page">
          <div className="bs-right-page-scroll">{right}</div>
          {rightOverlay}
        </div>
      </div>
    </div>
  )
}
