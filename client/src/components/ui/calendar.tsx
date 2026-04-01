import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
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

  // Menghasilkan array tahun dari 1940 sampai 5 tahun kedepan
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: (currentYear + 5) - 1939 },
    (_, i) => 1940 + i
  );

  const goToPrevMonth = () => {
    const prev = new Date(month);
    prev.setMonth(prev.getMonth() - 1);
    setMonth(prev);
    if (props.onMonthChange) props.onMonthChange(prev);
  };

  const goToNextMonth = () => {
    const next = new Date(month);
    next.setMonth(next.getMonth() + 1);
    setMonth(next);
    if (props.onMonthChange) props.onMonthChange(next);
  };

  // Custom caption component with dropdowns + nav arrows
  const CustomCaption = (captionProps: { displayMonth: Date }) => {
    return (
      <div className="flex items-center justify-between gap-1 px-1 pb-2">
        {/* Tombol bulan sebelumnya */}
        <button
          onClick={goToPrevMonth}
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 p-0 shrink-0 opacity-70 hover:opacity-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Dropdown bulan & tahun */}
        <div className="flex items-center gap-1">
          <Select
            value={captionProps.displayMonth.getMonth().toString()}
            onValueChange={(value) => {
              const newMonth = new Date(month);
              newMonth.setMonth(parseInt(value));
              setMonth(newMonth);
              if (props.onMonthChange) props.onMonthChange(newMonth);
            }}
          >
            <SelectTrigger className="h-8 w-[110px] text-sm font-medium border-0 bg-transparent focus:ring-0 px-2">
              <SelectValue placeholder="Bulan" />
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
              if (props.onMonthChange) props.onMonthChange(newMonth);
            }}
          >
            <SelectTrigger className="h-8 w-[80px] text-sm font-medium border-0 bg-transparent focus:ring-0 px-2">
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

        {/* Tombol bulan berikutnya */}
        <button
          onClick={goToNextMonth}
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 p-0 shrink-0 opacity-70 hover:opacity-100"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      month={month}
      onMonthChange={setMonth}
      defaultMonth={month}
      locale={idLocale}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-2 w-full",
        caption: "hidden",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell:
          "text-muted-foreground rounded-md flex-1 font-semibold text-[0.75rem] text-center uppercase tracking-wide py-1",
        row: "flex w-full mt-1",
        cell: cn(
          "flex-1 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected])]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "w-full h-9 p-0 font-normal aria-selected:opacity-100 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        day_today:
          "bg-accent text-accent-foreground font-semibold ring-1 ring-primary/30 rounded-full",
        day_outside:
          "day-outside text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
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
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
