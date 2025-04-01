import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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

export type ComboboxOption = {
  value: string
  label: string
}

interface CommandComboboxProps {
  options: ComboboxOption[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function CommandCombobox({
  options,
  value,
  onSelect,
  placeholder = "Pilih opsi...",
  emptyMessage = "Tidak ada opsi ditemukan.",
  className,
  disabled = false,
}: CommandComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selected = React.useMemo(() => 
    options.find((option) => option.value === value), 
    [options, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-full">
        <Command filter={(value, search) => {
          // Command's filter is already handled by our search function
          return 1
        }}>
          <CommandInput 
            placeholder="Cari..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options
                .filter(option => 
                  option.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  option.value.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onSelect(option.value)
                      setOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected?.value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))
              }
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}