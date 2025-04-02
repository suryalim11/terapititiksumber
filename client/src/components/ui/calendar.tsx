import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { format } from "date-fns"
import { id as idLocale } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.defaultMonth || new Date());

  // Menghasilkan array bulan dalam bahasa Indonesia
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Menghasilkan array tahun dari 1940 sampai tahun sekarang
  const years = Array.from(
    { length: new Date().getFullYear() - 1939 },
    (_, i) => 1940 + i
  );

  // Custom caption component with dropdowns
  const CustomCaption = (captionProps: { displayMonth: Date }) => {
    return (
      <div className="flex justify-center space-x-2 mb-2 pt-1">
        <Select
          value={captionProps.displayMonth.getMonth().toString()}
          onValueChange={(value) => {
            const newMonth = new Date(month);
            newMonth.setMonth(parseInt(value));
            setMonth(newMonth);
            if (props.onMonthChange) {
              props.onMonthChange(newMonth);
            }
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Pilih Bulan" />
          </SelectTrigger>
          <SelectContent>
            {months.map((monthName, i) => (
              <SelectItem key={i} value={i.toString()}>
                {monthName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={captionProps.displayMonth.getFullYear().toString()}
          onValueChange={(value) => {
            const newMonth = new Date(month);
            newMonth.setFullYear(parseInt(value));
            setMonth(newMonth);
            if (props.onMonthChange) {
              props.onMonthChange(newMonth);
            }
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px] overflow-y-auto">
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        month={month}
        onMonthChange={setMonth}
        defaultMonth={month}
        locale={idLocale}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-2",
          caption: "hidden", // Hide the default caption
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell:
            "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
          IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
          Caption: CustomCaption
        }}
        {...props}
      />
    </div>
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
