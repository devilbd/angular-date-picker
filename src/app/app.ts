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
