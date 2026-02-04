import { Component, OnInit, signal, computed, output, model, ChangeDetectionStrategy } from '@angular/core';
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
    public selectedDate = model<Date | null>(null);
    public viewDate = signal(new Date());

    // Working (unconfirmed) signals
    public workingDate = signal<Date | null>(null);
    public workingHours = signal(12);
    public workingMinutes = signal(0);
    public workingPeriod = signal<'AM' | 'PM'>('AM');

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

      const working = this.workingDate();
      const selectedCompare = working ? new Date(working.getFullYear(), working.getMonth(), working.getDate()).getTime() : null;

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
      this.initWorkingState();
    }

    private initWorkingState(): void {
      const baseDate = this.selectedDate() || new Date();
      this.workingDate.set(this.selectedDate());
      this.viewDate.set(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
      
      this.workingHours.set(baseDate.getHours() % 12 || 12);
      this.workingMinutes.set(baseDate.getMinutes());
      this.workingPeriod.set(baseDate.getHours() >= 12 ? 'PM' : 'AM');
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
      if (!this.isOpen()) {
        this.initWorkingState();
      }
      this.isOpen.update(v => !v);
    }

    public selectDay(day: CalendarDay): void {
      this.workingDate.set(new Date(day.date));
    }

    public confirmSelection(): void {
      const working = this.workingDate();
      if (working) {
        const confirmed = new Date(working);
        this.updateDateWithTime(confirmed);
        this.selectedDate.set(confirmed);
        this.emitSelection();
      }
      this.isOpen.set(false);
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
      let h = this.workingHours();
      if (isNaN(h) || h < 1) h = 1;
      if (h > 12) h = 12;
      this.workingHours.set(h);

      let m = this.workingMinutes();
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;
      this.workingMinutes.set(m);
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
      let h = this.workingHours();
      const p = this.workingPeriod();
      if (p === 'PM' && h !== 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
      date.setHours(h, this.workingMinutes(), 0, 0);
    }

    private emitSelection(): void {
      const date = this.selectedDate();
      if (date) {
        this.dateSelected.emit(date);
      }
    }
}
