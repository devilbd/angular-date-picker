import { Component, signal, computed, output, model, input, ChangeDetectionStrategy, effect, ElementRef, ViewChild, Renderer2, inject, HostListener } from '@angular/core';

export interface DateRestriction {
    minDate?: Date;
    maxDate?: Date;
    daysBack?: number;
    daysForward?: number;
    weeksBack?: number;
    weeksForward?: number;
    monthsBack?: number;
    monthsForward?: number;
    yearsBack?: number;
    yearsForward?: number;
    pastOnly?: boolean;
    futureOnly?: boolean;
    disabledDates?: Date[];
    minTime?: string; // HH:mm format
    maxTime?: string; // HH:mm format
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
}

@Component({
    selector: 'app-date-picker',
    imports: [],
    templateUrl: './date-picker.component.html',
    styleUrls: ['./date-picker.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerComponent {
    // Signals for state management
    public isOpen = model(false);
    public selectedDate = model<Date | null>(null);
    public viewDate = signal(new Date());
    public enableBlur = model<boolean>(false);
    public position = input<'top' | 'bottom' | 'left' | 'right'>('bottom');
    public restrictions = input<DateRestriction | null>(null);

    @ViewChild('overlay') overlay!: ElementRef;
    
    private elementRef = inject(ElementRef);
    private renderer = inject(Renderer2);

    // Computed restriction bounds
    private effectiveMinDate = computed(() => {
      const rest = this.restrictions();
      if (!rest) return null;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const bounds: (number | null)[] = [];

      if (rest.minDate) bounds.push(rest.minDate.getTime());
      if (rest.daysBack !== undefined) bounds.push(startOfToday.getTime() - rest.daysBack * 86400000);
      if (rest.weeksBack !== undefined) bounds.push(startOfToday.getTime() - rest.weeksBack * 7 * 86400000);
      if (rest.monthsBack !== undefined) {
        const d = new Date(startOfToday);
        d.setMonth(d.getMonth() - rest.monthsBack);
        bounds.push(d.getTime());
      }
      if (rest.yearsBack !== undefined) {
        const d = new Date(startOfToday);
        d.setFullYear(d.getFullYear() - rest.yearsBack);
        bounds.push(d.getTime());
      }
      if (rest.futureOnly) bounds.push(now.getTime());

      const validBounds = bounds.filter((b): b is number => b !== null);
      return validBounds.length > 0 ? new Date(Math.max(...validBounds)) : null;
    });

    private effectiveMaxDate = computed(() => {
      const rest = this.restrictions();
      if (!rest) return null;

      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const bounds: (number | null)[] = [];

      if (rest.maxDate) bounds.push(rest.maxDate.getTime());
      if (rest.daysForward !== undefined) bounds.push(endOfToday.getTime() + rest.daysForward * 86400000);
      if (rest.weeksForward !== undefined) bounds.push(endOfToday.getTime() + rest.weeksForward * 7 * 86400000);
      if (rest.monthsForward !== undefined) {
        const d = new Date(endOfToday);
        d.setMonth(d.getMonth() + rest.monthsForward);
        bounds.push(d.getTime());
      }
      if (rest.yearsForward !== undefined) {
        const d = new Date(endOfToday);
        d.setFullYear(d.getFullYear() + rest.yearsForward);
        bounds.push(d.getTime());
      }
      if (rest.pastOnly) bounds.push(now.getTime());

      const validBounds = bounds.filter((b): b is number => b !== null);
      return validBounds.length > 0 ? new Date(Math.min(...validBounds)) : null;
    });

    // Working (unconfirmed) signals
    public workingDate = signal<Date | null>(null);
    public workingHours = signal<number>(12);
    public workingMinutes = signal<number>(0);
    public workingPeriod = signal<'AM' | 'PM'>('AM');

    // View state
    public viewMode = signal<'calendar' | 'year'>('calendar');
    public years = computed(() => {
      const currentYear = this.viewDate().getFullYear();
      const startYear = currentYear - 10;
      return Array.from({ length: 21 }, (_, i) => startYear + i);
    });

    // Utils
    public parseInt = parseInt;

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

    constructor() {
      effect(() => {
        if (this.isOpen()) {
          this.initWorkingState();
          this.viewMode.set('calendar');
          // Wait for render
          setTimeout(() => this.updateOverlayPosition());
        }
      });
    }

    @HostListener('window:resize')
    @HostListener('window:scroll')
    public onResizeOrScroll(): void {
      if (this.isOpen()) {
        this.updateOverlayPosition();
      }
    }

    private updateOverlayPosition(): void {
      if (!this.overlay || !this.elementRef) return;

      const host = this.elementRef.nativeElement;
      const overlayEl = this.overlay.nativeElement;
      const hostRect = host.getBoundingClientRect();
      const overlayRect = overlayEl.getBoundingClientRect();
      
      const pos = this.position();
      const margin = 8;
      
      let top = 0;
      let left = 0;

      switch (pos) {
        case 'bottom':
          top = hostRect.bottom + margin;
          left = hostRect.left;
          break;
        case 'top':
          top = hostRect.top - overlayRect.height - margin;
          left = hostRect.left;
          break;
        case 'left':
          top = hostRect.top;
          left = hostRect.left - overlayRect.width - margin;
          break;
        case 'right':
          top = hostRect.top;
          left = hostRect.right + margin;
          break;
      }

      // Clamping to viewport
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (left < margin) left = margin;
      if (left + overlayRect.width > viewportWidth - margin) {
        left = viewportWidth - overlayRect.width - margin;
      }

      if (top < margin) top = margin;
      if (top + overlayRect.height > viewportHeight - margin) {
        top = viewportHeight - overlayRect.height - margin;
      }

      this.renderer.setStyle(overlayEl, 'position', 'fixed');
      this.renderer.setStyle(overlayEl, 'top', `${top}px`);
      this.renderer.setStyle(overlayEl, 'left', `${left}px`);
    }

    private initWorkingState(): void {
      const baseDate = this.selectedDate() || new Date();
      this.workingDate.set(this.selectedDate());
      this.viewDate.set(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
      
      this.workingHours.set(baseDate.getHours() % 12 || 12);
      this.workingMinutes.set(baseDate.getMinutes());
      this.workingPeriod.set(baseDate.getHours() >= 12 ? 'PM' : 'AM');
      
      this.enforceTimeRestrictions();
    }

    private createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date, selectedTime: number | null): CalendarDay {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
      
      const min = this.effectiveMinDate();
      const max = this.effectiveMaxDate();
      const rest = this.restrictions();

      let isDisabled = false;
      if (min && dayEnd < min.getTime()) isDisabled = true;
      if (max && dayStart > max.getTime()) isDisabled = true;
      
      if (rest?.disabledDates) {
        const isDisabledSpecific = rest.disabledDates.some(d => 
          d.getFullYear() === date.getFullYear() && 
          d.getMonth() === date.getMonth() && 
          d.getDate() === date.getDate()
        );
        if (isDisabledSpecific) isDisabled = true;
      }

      return {
        date,
        isCurrentMonth,
        isToday: dayStart === today.getTime(),
        isSelected: dayStart === selectedTime,
        isDisabled,
      };
    }


    public selectDay(day: CalendarDay): void {
      if (day.isDisabled) return;
      this.workingDate.set(new Date(day.date));
      this.enforceTimeRestrictions();
    }

    public toggleYearPicker(): void {
      this.viewMode.update(v => v === 'calendar' ? 'year' : 'calendar');
    }

    public selectYear(year: number): void {
      const current = this.viewDate();
      this.viewDate.set(new Date(year, current.getMonth(), 1));
      
      const working = this.workingDate();
      if (working) {
        const updated = new Date(working);
        updated.setFullYear(year);
        this.workingDate.set(updated);
      }

      this.viewMode.set('calendar');
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
      // Basic numeric constraints
      let h = this.workingHours();
      if (isNaN(h) || h < 1) h = 1;
      if (h > 12) h = 12;
      this.workingHours.set(h);

      let m = this.workingMinutes();
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;
      this.workingMinutes.set(m);

      this.enforceTimeRestrictions();
    }

    private enforceTimeRestrictions(): void {
      const rest = this.restrictions();
      if (!rest) return;

      const working = this.workingDate();
      if (!working) return;

      const current = new Date(working);
      this.updateDateWithTime(current);

      const min = this.effectiveMinDate();
      const max = this.effectiveMaxDate();

      // Check minDate restriction
      if (min && current.getTime() < min.getTime()) {
        this.applyDateToWorking(min);
        this.updateDateWithTime(current);
      }

      // Check maxDate restriction
      if (max && current.getTime() > max.getTime()) {
        this.applyDateToWorking(max);
        this.updateDateWithTime(current);
      }

      // Check per-day minTime/maxTime restrictions
      if (rest.minTime || rest.maxTime) {
        const timeVal = this.workingHours24() * 60 + this.workingMinutes();
        
        if (rest.minTime) {
          const [minH, minM] = rest.minTime.split(':').map(Number);
          const minVal = minH * 60 + minM;
          if (timeVal < minVal) {
            this.setWorkingTime(minH, minM);
          }
        }

        if (rest.maxTime) {
          const [maxH, maxM] = rest.maxTime.split(':').map(Number);
          const maxVal = maxH * 60 + maxM;
          if (timeVal > maxVal) {
            this.setWorkingTime(maxH, maxM);
          }
        }
      }
    }

    private workingHours24(): number {
      let h = this.workingHours();
      const p = this.workingPeriod();
      if (p === 'PM' && h !== 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
      return h;
    }

    private setWorkingTime(h24: number, m: number): void {
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      this.workingHours.set(h12);
      this.workingMinutes.set(m);
      this.workingPeriod.set(period);
    }

    private applyDateToWorking(date: Date): void {
      this.setWorkingTime(date.getHours(), date.getMinutes());
    }

    public handleTimeKeydown(event: KeyboardEvent): void {
      const target = event.target as HTMLInputElement;
      const key = event.key;

      // Allow control keys (Backspace, Tab, Enter, Escape, Delete, Arrows, etc.)
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

    public handleWheel(event: WheelEvent, type: 'hours' | 'minutes'): void {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1 : -1;
      
      if (type === 'hours') {
        let h = this.workingHours() + delta;
        if (h > 12) h = 1;
        if (h < 1) h = 12;
        this.workingHours.set(h);
      } else {
        let m = this.workingMinutes() + delta;
        if (m > 59) m = 0;
        if (m < 0) m = 59;
        this.workingMinutes.set(m);
      }
      this.onTimeChange();
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
