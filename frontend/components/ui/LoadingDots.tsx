import React from "react"

const LoadingDots: React.FC = () => {
  return (
    <span className="loading-dots">
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <style jsx>{`
        .loading-dots {
          display: inline-block;
          font-size: 24px;
        }
        .dot {
          opacity: 0;
          animation: showHideDot 1.5s ease-in-out infinite;
        }
        .dot:nth-child(1) {
          animation-delay: 0s;
        }
        .dot:nth-child(2) {
          animation-delay: 0.5s;
        }
        .dot:nth-child(3) {
          animation-delay: 1s;
        }
        @keyframes showHideDot {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </span>
  )
}

export default LoadingDots
