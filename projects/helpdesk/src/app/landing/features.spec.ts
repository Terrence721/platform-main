import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EntityDataService, provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { CapabilitiesDataService } from './capabilities.data-service';
import { CAPABILITIES, CAPABILITY } from './capability';
import { CapabilitiesSection } from './features';

describe('CapabilitiesSection', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(),
        provideEffects(),
        provideEntityData(
          { entityMetadata: { [CAPABILITY]: {} } },
          withEffects()
        ),
      ],
    });
    TestBed.inject(EntityDataService).registerService(
      CAPABILITY,
      TestBed.inject(CapabilitiesDataService)
    );
    const fixture = TestBed.createComponent(CapabilitiesSection);
    fixture.detectChanges();
    return {
      section: fixture.nativeElement as HTMLElement,
      http: TestBed.inject(HttpTestingController),
    };
  }

  const cards = (section: HTMLElement) =>
    [...section.querySelectorAll('li mat-card')].map((card) => ({
      icon: card.querySelector('mat-icon')?.textContent?.trim(),
      title: card.querySelector('h3')?.textContent?.trim(),
      summary: card.querySelector('p')?.textContent?.trim(),
    }));

  it('loads the capabilities and shows each one as a card, in order', () => {
    const { section, http } = render();

    expect(cards(section)).toEqual(
      CAPABILITIES.map(({ icon, title, summary }) => ({ icon, title, summary }))
    );
    http.verify();
  });

  it('lists the cards, so a screen reader can count them', () => {
    const { section } = render();

    expect(section.querySelectorAll('ul > li')).toHaveLength(6);
  });

  it('heads the section with an h2 the page can label it by', () => {
    const heading = render().section.querySelector('h2');

    expect(heading?.id).toBe('capabilities-title');
    expect(heading?.textContent?.trim()).toBe(
      'Everything a support team works with, in one place'
    );
  });

  // As with the cards (#1024): unassigned tickets are kept in view, not
  // made impossible, and nothing measures how fast a list is.
  it('introduces the cards with nothing the app lacks', () => {
    const intro = render()
      .section.querySelector('header p')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

    expect(intro).toBe(
      'Built for the people answering requests all day: clear deadlines, the most urgent work first, and the tickets nobody holds yet in plain view.'
    );
    expect(intro).not.toMatch(/without an owner|fast/i);
  });

  it('keeps the icons out of what a screen reader says', () => {
    const icons = [...render().section.querySelectorAll('mat-icon')];

    expect(icons.map((icon) => icon.getAttribute('aria-hidden'))).toEqual(
      Array(6).fill('true')
    );
  });
});
