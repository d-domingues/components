import {Direction, Directionality} from '@angular/cdk/bidi';
import {END, ENTER, HOME, LEFT_ARROW, RIGHT_ARROW, SPACE} from '@angular/cdk/keycodes';
import {PortalModule} from '@angular/cdk/portal';
import {ScrollingModule, ViewportRuler} from '@angular/cdk/scrolling';
import {
  dispatchFakeEvent,
  dispatchKeyboardEvent,
  createKeyboardEvent,
  dispatchEvent,
  createMouseEvent,
} from '../../cdk/testing/private';
import {CommonModule} from '@angular/common';
import {Component, ViewChild} from '@angular/core';
import {
  waitForAsync,
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import {MatRippleModule} from '@angular/material-experimental/mdc-core';
import {By} from '@angular/platform-browser';
import {MatTabHeader} from './tab-header';
import {MatTabLabelWrapper} from './tab-label-wrapper';
import {Subject} from 'rxjs';
import {ObserversModule, MutationObserverFactory} from '@angular/cdk/observers';


describe('MDC-based MatTabHeader', () => {
  let dir: Direction = 'ltr';
  let change = new Subject();
  let fixture: ComponentFixture<SimpleTabHeaderApp>;
  let appComponent: SimpleTabHeaderApp;

  beforeEach(waitForAsync(() => {
    dir = 'ltr';
    TestBed.configureTestingModule({
      imports: [CommonModule, PortalModule, MatRippleModule, ScrollingModule, ObserversModule],
      declarations: [
        MatTabHeader,
        MatTabLabelWrapper,
        SimpleTabHeaderApp,
      ],
      providers: [
        ViewportRuler,
        {provide: Directionality, useFactory: () => ({value: dir, change: change})},
      ]
    });

    TestBed.compileComponents();
  }));

  describe('focusing', () => {
    let tabListContainer: HTMLElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleTabHeaderApp);
      fixture.detectChanges();

      appComponent = fixture.componentInstance;
      tabListContainer = appComponent.tabHeader._tabListContainer.nativeElement;
    });

    it('should initialize to the selected index', () => {
      // Recreate the fixture so we can test that it works with a non-default selected index
      fixture.destroy();
      fixture = TestBed.createComponent(SimpleTabHeaderApp);
      fixture.componentInstance.selectedIndex = 1;
      fixture.detectChanges();
      appComponent = fixture.componentInstance;
      tabListContainer = appComponent.tabHeader._tabListContainer.nativeElement;

      expect(appComponent.tabHeader.focusIndex).toBe(1);
    });

    it('should send focus change event', () => {
      appComponent.tabHeader.focusIndex = 2;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(2);
    });

    it('should not set focus a disabled tab', () => {
      appComponent.tabHeader.focusIndex = 0;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      // Set focus on the disabled tab, but focus should remain 0
      appComponent.tabHeader.focusIndex = appComponent.disabledTabIndex;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);
    });

    it('should move focus right and skip disabled tabs', () => {
      appComponent.tabHeader.focusIndex = 0;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      // Move focus right, verify that the disabled tab is 1 and should be skipped
      expect(appComponent.disabledTabIndex).toBe(1);
      dispatchKeyboardEvent(tabListContainer, 'keydown', RIGHT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(2);

      // Move focus right to index 3
      dispatchKeyboardEvent(tabListContainer, 'keydown', RIGHT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(3);
    });

    it('should move focus left and skip disabled tabs', () => {
      appComponent.tabHeader.focusIndex = 3;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(3);

      // Move focus left to index 3
      dispatchKeyboardEvent(tabListContainer, 'keydown', LEFT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(2);

      // Move focus left, verify that the disabled tab is 1 and should be skipped
      expect(appComponent.disabledTabIndex).toBe(1);
      dispatchKeyboardEvent(tabListContainer, 'keydown', LEFT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);
    });

    it('should support key down events to move and select focus', () => {
      appComponent.tabHeader.focusIndex = 0;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      // Move focus right to 2
      dispatchKeyboardEvent(tabListContainer, 'keydown', RIGHT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(2);

      // Select the focused index 2
      expect(appComponent.selectedIndex).toBe(0);
      const enterEvent = dispatchKeyboardEvent(tabListContainer, 'keydown', ENTER);
      fixture.detectChanges();
      expect(appComponent.selectedIndex).toBe(2);
      expect(enterEvent.defaultPrevented).toBe(true);

      // Move focus right to 0
      dispatchKeyboardEvent(tabListContainer, 'keydown', LEFT_ARROW);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      // Select the focused 0 using space.
      expect(appComponent.selectedIndex).toBe(2);
      const spaceEvent = dispatchKeyboardEvent(tabListContainer, 'keydown', SPACE);
      fixture.detectChanges();
      expect(appComponent.selectedIndex).toBe(0);
      expect(spaceEvent.defaultPrevented).toBe(true);
    });

    it('should not prevent the default space/enter action if the current is selected', () => {
      appComponent.tabHeader.focusIndex = appComponent.tabHeader.selectedIndex = 0;
      fixture.detectChanges();

      const spaceEvent = dispatchKeyboardEvent(tabListContainer, 'keydown', SPACE);
      fixture.detectChanges();
      expect(spaceEvent.defaultPrevented).toBe(false);

      const enterEvent = dispatchKeyboardEvent(tabListContainer, 'keydown', ENTER);
      fixture.detectChanges();
      expect(enterEvent.defaultPrevented).toBe(false);
    });

    it('should move focus to the first tab when pressing HOME', () => {
      appComponent.tabHeader.focusIndex = 3;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(3);

      const event = dispatchKeyboardEvent(tabListContainer, 'keydown', HOME);
      fixture.detectChanges();

      expect(appComponent.tabHeader.focusIndex).toBe(0);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should skip disabled items when moving focus using HOME', () => {
      appComponent.tabHeader.focusIndex = 3;
      appComponent.tabs[0].disabled = true;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(3);

      dispatchKeyboardEvent(tabListContainer, 'keydown', HOME);
      fixture.detectChanges();

      // Note that the second tab is disabled by default already.
      expect(appComponent.tabHeader.focusIndex).toBe(2);
    });

    it('should move focus to the last tab when pressing END', () => {
      appComponent.tabHeader.focusIndex = 0;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      const event = dispatchKeyboardEvent(tabListContainer, 'keydown', END);
      fixture.detectChanges();

      expect(appComponent.tabHeader.focusIndex).toBe(3);
      expect(event.defaultPrevented).toBe(true);
    });

    it('should skip disabled items when moving focus using END', () => {
      appComponent.tabHeader.focusIndex = 0;
      appComponent.tabs[3].disabled = true;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      dispatchKeyboardEvent(tabListContainer, 'keydown', END);
      fixture.detectChanges();

      expect(appComponent.tabHeader.focusIndex).toBe(2);
    });

    it('should not do anything if a modifier key is pressed', () => {
      const rightArrowEvent = createKeyboardEvent('keydown', RIGHT_ARROW, undefined, {shift: true});
      const enterEvent = createKeyboardEvent('keydown', ENTER, undefined, {shift: true});

      appComponent.tabHeader.focusIndex = 0;
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);

      dispatchEvent(tabListContainer, rightArrowEvent);
      fixture.detectChanges();
      expect(appComponent.tabHeader.focusIndex).toBe(0);
      expect(rightArrowEvent.defaultPrevented).toBe(false);

      expect(appComponent.selectedIndex).toBe(0);
      dispatchEvent(tabListContainer, enterEvent);
      fixture.detectChanges();
      expect(appComponent.selectedIndex).toBe(0);
      expect(enterEvent.defaultPrevented).toBe(false);
    });

  });

  describe('pagination', () => {
    describe('ltr', () => {
      beforeEach(() => {
        dir = 'ltr';
        fixture = TestBed.createComponent(SimpleTabHeaderApp);
        fixture.detectChanges();

        appComponent = fixture.componentInstance;
      });

      it('should show width when tab list width exceeds container', () => {
        fixture.detectChanges();
        expect(appComponent.tabHeader._showPaginationControls).toBe(false);

        // Add enough tabs that it will obviously exceed the width
        appComponent.addTabsForScrolling();
        fixture.detectChanges();

        expect(appComponent.tabHeader._showPaginationControls).toBe(true);
      });

      it('should scroll to show the focused tab label', () => {
        appComponent.addTabsForScrolling();
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);

        // Focus on the last tab, expect this to be the maximum scroll distance.
        appComponent.tabHeader.focusIndex = appComponent.tabs.length - 1;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance)
            .toBe(appComponent.tabHeader._getMaxScrollDistance());

        // Focus on the first tab, expect this to be the maximum scroll distance.
        appComponent.tabHeader.focusIndex = 0;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);
      });

      it('should show ripples for pagination buttons', () => {
        appComponent.addTabsForScrolling();
        fixture.detectChanges();

        expect(appComponent.tabHeader._showPaginationControls).toBe(true);

        const buttonAfter =
            fixture.debugElement.query(By.css('.mat-mdc-tab-header-pagination-after'));

        expect(fixture.nativeElement.querySelectorAll('.mat-ripple-element').length)
          .withContext('Expected no ripple to show up initially.').toBe(0);

        dispatchFakeEvent(buttonAfter.nativeElement, 'mousedown');
        dispatchFakeEvent(buttonAfter.nativeElement, 'mouseup');

        expect(fixture.nativeElement.querySelectorAll('.mat-ripple-element').length)
          .withContext('Expected one ripple to show up after mousedown').toBe(1);
      });

      it('should allow disabling ripples for pagination buttons', () => {
        appComponent.addTabsForScrolling();
        appComponent.disableRipple = true;
        fixture.detectChanges();

        expect(appComponent.tabHeader._showPaginationControls).toBe(true);

        const buttonAfter =
            fixture.debugElement.query(By.css('.mat-mdc-tab-header-pagination-after'));

        expect(fixture.nativeElement.querySelectorAll('.mat-ripple-element').length)
          .withContext('Expected no ripple to show up initially.').toBe(0);

        dispatchFakeEvent(buttonAfter.nativeElement, 'mousedown');
        dispatchFakeEvent(buttonAfter.nativeElement, 'mouseup');

        expect(fixture.nativeElement.querySelectorAll('.mat-ripple-element').length)
          .withContext('Expected no ripple to show up after mousedown').toBe(0);
      });

    });

    describe('rtl', () => {
      beforeEach(() => {
        dir = 'rtl';
        fixture = TestBed.createComponent(SimpleTabHeaderApp);
        appComponent = fixture.componentInstance;
        appComponent.dir = 'rtl';

        fixture.detectChanges();
      });

      it('should scroll to show the focused tab label', () => {
        appComponent.addTabsForScrolling();
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);

        // Focus on the last tab, expect this to be the maximum scroll distance.
        appComponent.tabHeader.focusIndex = appComponent.tabs.length - 1;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance)
            .toBe(appComponent.tabHeader._getMaxScrollDistance());

        // Focus on the first tab, expect this to be the maximum scroll distance.
        appComponent.tabHeader.focusIndex = 0;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);
      });
    });

    describe('scrolling when holding paginator', () => {
      let nextButton: HTMLElement;
      let prevButton: HTMLElement;
      let header: MatTabHeader;
      let headerElement: HTMLElement;

      beforeEach(() => {
        fixture = TestBed.createComponent(SimpleTabHeaderApp);
        fixture.componentInstance.disableRipple = true;
        fixture.detectChanges();

        fixture.componentInstance.addTabsForScrolling(50);
        fixture.detectChanges();

        nextButton = fixture.nativeElement.querySelector('.mat-mdc-tab-header-pagination-after');
        prevButton = fixture.nativeElement.querySelector('.mat-mdc-tab-header-pagination-before');
        header = fixture.componentInstance.tabHeader;
        headerElement = fixture.nativeElement.querySelector('.mat-mdc-tab-header');
      });

      it('should scroll towards the end while holding down the next button using a mouse',
        fakeAsync(() => {
          assertNextButtonScrolling('mousedown', 'click');
        }));

      it('should scroll towards the start while holding down the prev button using a mouse',
        fakeAsync(() => {
          assertPrevButtonScrolling('mousedown', 'click');
        }));

      it('should scroll towards the end while holding down the next button using touch',
        fakeAsync(() => {
          assertNextButtonScrolling('touchstart', 'touchend');
        }));

      it('should scroll towards the start while holding down the prev button using touch',
        fakeAsync(() => {
          assertPrevButtonScrolling('touchstart', 'touchend');
        }));

      it('should not scroll if the sequence is interrupted quickly', fakeAsync(() => {
        expect(header.scrollDistance)
          .withContext('Expected to start off not scrolled.').toBe(0);

        dispatchFakeEvent(nextButton, 'mousedown');
        fixture.detectChanges();

        tick(100);

        dispatchFakeEvent(headerElement, 'mouseleave');
        fixture.detectChanges();

        tick(3000);

        expect(header.scrollDistance)
          .withContext('Expected not to have scrolled after a while.').toBe(0);
      }));

      it('should clear the timeouts on destroy', fakeAsync(() => {
        dispatchFakeEvent(nextButton, 'mousedown');
        fixture.detectChanges();
        fixture.destroy();

        // No need to assert. If fakeAsync doesn't throw, it means that the timers were cleared.
      }));

      it('should clear the timeouts on click', fakeAsync(() => {
        dispatchFakeEvent(nextButton, 'mousedown');
        fixture.detectChanges();

        dispatchFakeEvent(nextButton, 'click');
        fixture.detectChanges();

        // No need to assert. If fakeAsync doesn't throw, it means that the timers were cleared.
      }));

      it('should clear the timeouts on touchend', fakeAsync(() => {
        dispatchFakeEvent(nextButton, 'touchstart');
        fixture.detectChanges();

        dispatchFakeEvent(nextButton, 'touchend');
        fixture.detectChanges();

        // No need to assert. If fakeAsync doesn't throw, it means that the timers were cleared.
      }));

      it('should clear the timeouts when reaching the end', fakeAsync(() => {
        dispatchFakeEvent(nextButton, 'mousedown');
        fixture.detectChanges();

        // Simulate a very long timeout.
        tick(60000);

        // No need to assert. If fakeAsync doesn't throw, it means that the timers were cleared.
      }));

      it('should clear the timeouts when reaching the start', fakeAsync(() => {
        header.scrollDistance = Infinity;
        fixture.detectChanges();

        dispatchFakeEvent(prevButton, 'mousedown');
        fixture.detectChanges();

        // Simulate a very long timeout.
        tick(60000);

        // No need to assert. If fakeAsync doesn't throw, it means that the timers were cleared.
      }));

      it('should stop scrolling if the pointer leaves the header', fakeAsync(() => {
        expect(header.scrollDistance)
          .withContext('Expected to start off not scrolled.').toBe(0);

        dispatchFakeEvent(nextButton, 'mousedown');
        fixture.detectChanges();
        tick(300);

        expect(header.scrollDistance)
          .withContext('Expected not to scroll after short amount of time.').toBe(0);

        tick(1000);

        expect(header.scrollDistance)
          .withContext('Expected to scroll after some time.').toBeGreaterThan(0);

        let previousDistance = header.scrollDistance;

        dispatchFakeEvent(headerElement, 'mouseleave');
        fixture.detectChanges();
        tick(100);

        expect(header.scrollDistance).toBe(previousDistance);
      }));

      it('should not scroll when pressing the right mouse button', fakeAsync(() => {
        expect(header.scrollDistance)
          .withContext('Expected to start off not scrolled.').toBe(0);

        dispatchEvent(nextButton, createMouseEvent('mousedown', undefined, undefined, 2));
        fixture.detectChanges();
        tick(3000);

        expect(header.scrollDistance)
          .withContext('Expected not to have scrolled after a while.').toBe(0);
      }));

      /**
       * Asserts that auto scrolling using the next button works.
       * @param startEventName Name of the event that is supposed to start the scrolling.
       * @param endEventName Name of the event that is supposed to end the scrolling.
       */
      function assertNextButtonScrolling(startEventName: string, endEventName: string) {
        expect(header.scrollDistance)
          .withContext('Expected to start off not scrolled.').toBe(0);

        dispatchFakeEvent(nextButton, startEventName);
        fixture.detectChanges();
        tick(300);

        expect(header.scrollDistance)
          .withContext('Expected not to scroll after short amount of time.').toBe(0);

        tick(1000);

        expect(header.scrollDistance)
          .withContext('Expected to scroll after some time.').toBeGreaterThan(0);

        let previousDistance = header.scrollDistance;

        tick(100);

        expect(header.scrollDistance)
          .withContext('Expected to scroll again after some more time.')
          .toBeGreaterThan(previousDistance);

        dispatchFakeEvent(nextButton, endEventName);
      }

      /**
       * Asserts that auto scrolling using the previous button works.
       * @param startEventName Name of the event that is supposed to start the scrolling.
       * @param endEventName Name of the event that is supposed to end the scrolling.
       */
      function assertPrevButtonScrolling(startEventName: string, endEventName: string) {
        header.scrollDistance = Infinity;
        fixture.detectChanges();

        let currentScroll = header.scrollDistance;

        expect(currentScroll)
          .withContext('Expected to start off scrolled.').toBeGreaterThan(0);

        dispatchFakeEvent(prevButton, startEventName);
        fixture.detectChanges();
        tick(300);

        expect(header.scrollDistance)
          .withContext('Expected not to scroll after short amount of time.').toBe(currentScroll);

        tick(1000);

        expect(header.scrollDistance)
          .withContext('Expected to scroll after some time.').toBeLessThan(currentScroll);

        currentScroll = header.scrollDistance;

        tick(100);

        expect(header.scrollDistance)
          .withContext('Expected to scroll again after some more time.')
          .toBeLessThan(currentScroll);

        dispatchFakeEvent(nextButton, endEventName);
      }

    });

    describe('disabling pagination', () => {
      it('should not show the pagination controls if pagination is disabled', () => {
        fixture = TestBed.createComponent(SimpleTabHeaderApp);
        appComponent = fixture.componentInstance;
        appComponent.disablePagination = true;
        fixture.detectChanges();
        expect(appComponent.tabHeader._showPaginationControls).toBe(false);

        // Add enough tabs that it will obviously exceed the width
        appComponent.addTabsForScrolling();
        fixture.detectChanges();

        expect(appComponent.tabHeader._showPaginationControls).toBe(false);
      });

      it('should not change the scroll position if pagination is disabled', () => {
        fixture = TestBed.createComponent(SimpleTabHeaderApp);
        appComponent = fixture.componentInstance;
        appComponent.disablePagination = true;
        fixture.detectChanges();
        appComponent.addTabsForScrolling();
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);

        appComponent.tabHeader.focusIndex = appComponent.tabs.length - 1;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);

        appComponent.tabHeader.focusIndex = 0;
        fixture.detectChanges();
        expect(appComponent.tabHeader.scrollDistance).toBe(0);
      });
    });

    it('should re-align the ink bar when the direction changes', fakeAsync(() => {
      fixture = TestBed.createComponent(SimpleTabHeaderApp);
      fixture.detectChanges();

      const inkBar = fixture.componentInstance.tabHeader._inkBar;
      spyOn(inkBar, 'alignToElement');

      fixture.detectChanges();

      change.next();
      fixture.detectChanges();
      tick(20); // Angular turns rAF calls into 16.6ms timeouts in tests.

      expect(inkBar.alignToElement).toHaveBeenCalled();
    }));

    it('should re-align the ink bar when the window is resized', fakeAsync(() => {
      fixture = TestBed.createComponent(SimpleTabHeaderApp);
      fixture.detectChanges();

      const inkBar = fixture.componentInstance.tabHeader._inkBar;

      spyOn(inkBar, 'alignToElement');

      dispatchFakeEvent(window, 'resize');
      tick(150);
      fixture.detectChanges();

      expect(inkBar.alignToElement).toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    it('should update arrows when the window is resized', fakeAsync(() => {
      fixture = TestBed.createComponent(SimpleTabHeaderApp);

      const header = fixture.componentInstance.tabHeader;

      spyOn(header, '_checkPaginationEnabled');

      dispatchFakeEvent(window, 'resize');
      tick(10);
      fixture.detectChanges();

      expect(header._checkPaginationEnabled).toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    it('should update the pagination state if the content of the labels changes', () => {
      const mutationCallbacks: Function[] = [];
      TestBed.overrideProvider(MutationObserverFactory, {
        useValue: {
          // Stub out the MutationObserver since the native one is async.
          create: function(callback: Function) {
            mutationCallbacks.push(callback);
            return {observe: () => {}, disconnect: () => {}};
          }
        }
      });

      fixture = TestBed.createComponent(SimpleTabHeaderApp);
      fixture.detectChanges();

      const tabHeaderElement: HTMLElement =
          fixture.nativeElement.querySelector('.mat-mdc-tab-header');
      const labels =
          Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.label-content'));
      const extraText = new Array(100).fill('w').join();
      const enabledClass = 'mat-mdc-tab-header-pagination-controls-enabled';

      expect(tabHeaderElement.classList).not.toContain(enabledClass);

      labels.forEach(label => {
        label.style.width = '';
        label.textContent += extraText;
      });

      mutationCallbacks.forEach(callback => callback());
      fixture.detectChanges();

      expect(tabHeaderElement.classList).toContain(enabledClass);
    });

  });
});

interface Tab {
  label: string;
  disabled?: boolean;
}

@Component({
  template: `
  <div [dir]="dir">
    <mat-tab-header [selectedIndex]="selectedIndex" [disableRipple]="disableRipple"
               (indexFocused)="focusedIndex = $event"
               (selectFocusedIndex)="selectedIndex = $event"
               [disablePagination]="disablePagination">
      <div matTabLabelWrapper class="label-content" style="min-width: 30px; width: 30px"
           *ngFor="let tab of tabs; let i = index"
           [disabled]="!!tab.disabled"
           (click)="selectedIndex = i">
         {{tab.label}}
      </div>
    </mat-tab-header>
  </div>
  `,
  styles: [`
    :host {
      width: 130px;
    }
  `]
})
class SimpleTabHeaderApp {
  disableRipple: boolean = false;
  selectedIndex: number = 0;
  focusedIndex: number;
  disabledTabIndex = 1;
  tabs: Tab[] = [{label: 'tab one'}, {label: 'tab one'}, {label: 'tab one'}, {label: 'tab one'}];
  dir: Direction = 'ltr';
  disablePagination: boolean;

  @ViewChild(MatTabHeader, {static: true}) tabHeader: MatTabHeader;

  constructor() {
    this.tabs[this.disabledTabIndex].disabled = true;
  }

  addTabsForScrolling(amount = 4) {
    for (let i = 0; i < amount; i++) {
      this.tabs.push({label: 'new'});
    }
  }
}
