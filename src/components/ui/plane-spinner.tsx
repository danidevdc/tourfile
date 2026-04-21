import { Ship } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlaneSpinnerProps {
  className?: string
}

export function PlaneSpinner({ className }: PlaneSpinnerProps) {
  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)} 
      style={{ 
        width: className?.includes('w-') ? undefined : '3.5em', 
        height: className?.includes('h-') ? undefined : '3.5em',
      }}
    >
      {/* Lancha / Barco */}
      <div 
        className="absolute z-10"
        style={{
          animation: 'boatBob 2s ease-in-out infinite',
          top: '15%',
        }}
      >
        <Ship 
          style={{ 
            color: '#42a5fe',
            width: '2em',
            height: '2em',
          }}
          strokeWidth={1.5}
        />
      </div>

      {/* Ola única */}
      <div className="absolute bottom-[18%] left-[8%] right-[8%] h-[4px] rounded-full bg-[#42a5fe]/20 overflow-hidden z-20">
        <div
          className="w-1/2 h-full bg-[#42a5fe] rounded-full"
          style={{ animation: 'waterFlow1 1.5s ease-in-out infinite alternate' }}
        />
      </div>
    </div>
  )
}
