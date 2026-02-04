import { Component, signal } from '@angular/core';
import { DatePickerComponent } from "./date-picker/date-picker.component";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule, DatePickerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
    protected readonly title = signal('angular-date-picker');
    public selectedDate = signal<Date | null>(null);
    
    // Date and time restrictions
    public pickerRestrictions = {
      // daysBack: 0,
      // daysForward: 7,
      // minTime: '13:00', // 1 PM
      // maxTime: '18:00', // 6 PM
      // disabledDates: [new Date(new Date().setDate(new Date().getDate() + 2))]
    };

    constructor() {
      const saved = localStorage.getItem('selectedDate');
      if (saved) {
        this.selectedDate.set(new Date(saved));
      }
    }

    onDateSelected(date: Date) {
      this.selectedDate.set(date);
      localStorage.setItem('selectedDate', date.toISOString());
    }
}
