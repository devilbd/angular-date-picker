import { Component, signal } from '@angular/core';
import { DatePickerComponent } from "./date-picker/date-picker.component";

@Component({
  selector: 'app-root',
  imports: [DatePickerComponent],
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
