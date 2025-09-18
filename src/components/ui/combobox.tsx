
"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"

export interface ComboboxOption {
    value: string;
    label: string;
    key?: string; // Add optional key property
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    notFoundMessage?: string;
    className?: string;
    triggerClassName?: string;
    disabled?: boolean;
}


export function Combobox({ options, value, onSelect, placeholder, notFoundMessage, className, triggerClassName, disabled = false }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = options.find((option) => option.value.toUpperCase() === value.toUpperCase())?.label;

  return (
    <Popover open={open} onOpenChange={(newState) => !disabled && setOpen(newState)} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className, triggerClassName)}
          disabled={disabled}
        >
          <span className="truncate">
            {value ? selectedLabel : placeholder || "Select option..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full min-w-[var(--radix-popover-trigger-width)] p-0" 
        side="bottom" 
        align="start" 
        sideOffset={5}
      >
        <Command>
          <CommandInput placeholder={placeholder || "Search..."} />
          <CommandList>
            <ScrollArea 
                className="max-h-[250px] overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
            >
              <CommandEmpty>{notFoundMessage || "No option found."}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.key || option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onSelect(currentValue.toUpperCase() === value.toUpperCase() ? "" : currentValue.toUpperCase())
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.toUpperCase() === option.value.toUpperCase() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
