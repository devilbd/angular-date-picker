import { Component, OnInit, signal, computed, output, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
}

@Component({
    selector: 'app-date-picker',
    imports: [DatePipe],
    templateUrl: './date-picker.component.html',
    styleUrls: ['./date-picker.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerComponent implements OnInit {
    // Signals for state management
    public isOpen = signal(false);
    public selectedDate = signal<Date | null>(null);
    public viewDate = signal(new Date());

    // Time Signals
    public hours = signal(12);
    public minutes = signal(0);
    public period = signal<'AM' | 'PM'>('AM');

    // Outputs
    public dateSelected = output<Date>();

    // Computed properties
    public monthYearLabel = computed(() => {
      const date = this.viewDate();
      return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    });

    public calendarDays = computed(() => {
      const date = this.viewDate();
      const year = date.getFullYear();
      const month = date.getMonth();
      
      // First day of current month
      const firstDay = new Date(year, month, 1);
      const lastDayPreviousMonth = new Date(year, month, 0);
      const lastDayCurrentMonth = new Date(year, month + 1, 0);
      
      const days: CalendarDay[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selected = this.selectedDate();
      const selectedCompare = selected ? new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime() : null;

      // Days from previous month to fill the first row
      const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, lastDayPreviousMonth.getDate() - i);
        days.push(this.createCalendarDay(d, false, today, selectedCompare));
      }

      // Days of current month
      for (let i = 1; i <= lastDayCurrentMonth.getDate(); i++) {
        const d = new Date(year, month, i);
        days.push(this.createCalendarDay(d, true, today, selectedCompare));
      }

      // Days from next month to fill the last row
      const endDayOfWeek = lastDayCurrentMonth.getDay();
      const remainingDays = 6 - endDayOfWeek;
      for (let i = 1; i <= remainingDays; i++) {
        const d = new Date(year, month + 1, i);
        days.push(this.createCalendarDay(d, false, today, selectedCompare));
      }

      return days;
    });

    ngOnInit(): void {
      // Initialize with current time if needed
      const now = new Date();
      this.hours.set(now.getHours() % 12 || 12);
      this.minutes.set(now.getMinutes());
      this.period.set(now.getHours() >= 12 ? 'PM' : 'AM');
    }

    private createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date, selectedTime: number | null): CalendarDay {
      const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return {
        date,
        isCurrentMonth,
        isToday: compareDate === today.getTime(),
        isSelected: compareDate === selectedTime,
      };
    }

    public togglePicker(): void {
      this.isOpen.update(v => !v);
    }

    public selectDay(day: CalendarDay): void {
      const newDate = new Date(day.date);
      this.updateDateWithTime(newDate);
      this.selectedDate.set(newDate);
      this.emitSelection();
    }

    public prevMonth(): void {
      const current = this.viewDate();
      this.viewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    }

    public nextMonth(): void {
      const current = this.viewDate();
      this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    }

    public onTimeChange(): void {
      // Enforce constraints
      let h = this.hours();
      if (isNaN(h) || h < 1) h = 1;
      if (h > 12) h = 12;
      this.hours.set(h);

      let m = this.minutes();
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;
      this.minutes.set(m);

      const current = this.selectedDate();
      if (current) {
        const updated = new Date(current);
        this.updateDateWithTime(updated);
        this.selectedDate.set(updated);
        this.emitSelection();
      }
    }

    public handleTimeKeydown(event: KeyboardEvent): void {
      const target = event.target as HTMLInputElement;
      const key = event.key;

      // Allow control keys (Backspace, Tab, Enter, Delete, Arrows, etc.)
      const isControlKey = [
        'Backspace', 'Tab', 'Enter', 'Escape', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
      ].includes(key);

      if (isControlKey || (event.ctrlKey && ['a', 'c', 'v', 'x'].includes(key.toLowerCase()))) {
        return;
      }

      // Check if it's a digit
      if (!/^\d$/.test(key)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // If there's a selection, the keypress will replace it, so allow it
      if (target.selectionStart !== target.selectionEnd) {
        return;
      }

      // Prevent if already has 2 digits and we're not replacing anything
      if (target.value.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    private updateDateWithTime(date: Date): void {
      let h = this.hours();
      const p = this.period();
      if (p === 'PM' && h !== 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
      date.setHours(h, this.minutes(), 0, 0);
    }

    private emitSelection(): void {
      const date = this.selectedDate();
      if (date) {
        this.dateSelected.emit(date);
      }
    }
}
