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

    selectedDate: Date | null = null;

    onDateSelected(date: Date) {
      this.selectedDate = date;
    }
}
