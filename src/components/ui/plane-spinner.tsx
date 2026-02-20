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

      {/* Lago / Agua animada (Olas frontales) */}
      <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[4px] rounded-full bg-[#42a5fe]/20 overflow-hidden z-20">
        <div 
          className="w-1/2 h-full bg-[#42a5fe] rounded-full"
          style={{ animation: 'waterFlow1 1.5s ease-in-out infinite alternate' }}
        />
      </div>
      
      {/* Lago / Agua animada (Olas traseras) */}
      <div className="absolute bottom-[32%] left-[20%] right-[20%] h-[3px] rounded-full bg-[#42a5fe]/10 overflow-hidden z-0">
        <div 
          className="w-1/3 h-full bg-[#42a5fe]/60 rounded-full"
          style={{ animation: 'waterFlow2 2s ease-in-out infinite alternate-reverse' }}
        />
      </div>
    </div>
  )
}
