import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the app name as the toolbar heading', () => {
    const heading = render().querySelector('mat-toolbar h1');

    expect(heading?.textContent?.trim()).toBe('Helpdesk');
  });

  it('renders routed pages inside main', () => {
    expect(render().querySelector('main router-outlet')).not.toBeNull();
  });
});
